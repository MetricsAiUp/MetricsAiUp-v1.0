const router = require('express').Router();
const prisma = require('../config/database');
const settingsReader = require('./settings');

// Если данные с CV-системы не поступают дольше этого порога — считаем их
// несвежими: фронт покажет аварийный баннер, расчёты «загрузка/эффективность»
// замораживаются на моменте последнего реального события (а не дотягиваются до now).
const STALE_DATA_MS = 60 * 60 * 1000; // 1 час

// CV-система пингует каждые 10 секунд. Если между соседними записями истории
// проходит больше этого порога — считаем это «провалом» данных: предыдущее
// состояние не должно «протягиваться» через провал в метрики и таймлайн,
// иначе один кадр «occupied» в 09:30 заполнит весь день до возврата CV.
const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 минут

// Считает «время последнего знания» по массиву CV-объектов (постов и зон).
// Источники: mp.lastUpdate и timestamps из mp.history. Если данных нет вовсе —
// возвращаем dataAsOf=null и stale=true (фронт покажет «нет данных»).
function computeDataFreshness(items) {
  let maxTs = 0;
  for (const item of items || []) {
    if (!item) continue;
    const lu = item.lastUpdate ? new Date(item.lastUpdate).getTime() : 0;
    if (Number.isFinite(lu) && lu > maxTs) maxTs = lu;
    const hist = Array.isArray(item.history) ? item.history : [];
    for (const h of hist) {
      const ht = new Date(h?.timestamp || h?.lastUpdate || 0).getTime();
      if (Number.isFinite(ht) && ht > maxTs) maxTs = ht;
    }
  }
  if (maxTs <= 0) {
    return { dataAsOf: null, dataAsOfMs: null, dataAgeMs: null, stale: true };
  }
  const ageMs = Date.now() - maxTs;
  return {
    dataAsOf: new Date(maxTs).toISOString(),
    dataAsOfMs: maxTs,
    dataAgeMs: ageMs,
    stale: ageMs > STALE_DATA_MS,
  };
}

// Парсит wall-clock время "YYYY-MM-DD" + "HH:MM" в указанной IANA-таймзоне
// и возвращает соответствующий UTC-timestamp (ms). Не зависит от TZ хост-системы.
// Алгоритм: берём наивный UTC, форматируем в целевой TZ, считаем offset, корректируем.
function parseInTz(dateStr, timeStr, tz) {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  if (!Number.isFinite(naive)) return NaN;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(naive))
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const wallInTz = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  const offsetMs = wallInTz - naive; // насколько TZ опережает UTC в этот момент
  return naive - offsetMs;
}

function tzOf(settings) {
  return settings && settings.timezone ? settings.timezone : 'Europe/Moscow';
}

// Возвращает дату YYYY-MM-DD «по часам» указанной таймзоны (а не UTC).
function dateStrInTz(d, tz) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return dtf.format(d); // en-CA даёт YYYY-MM-DD
}

// Возвращает ключ дня недели (mon..sun) по часам TZ.
function dayKeyInTz(d, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const wk = dtf.format(d).toLowerCase(); // mon, tue...
  return wk;
}

// Активные посты из БД (после Этапа А — источник истины: Map (number → post)).
// Возвращает Map с гарантированно заполненными number.
async function getActivePostsMap() {
  const posts = await prisma.post.findMany({
    where: { deleted: false, number: { not: null } },
    orderBy: { number: 'asc' },
    include: { zone: { select: { name: true, displayName: true, displayNameEn: true } } },
  });
  const map = new Map();
  for (const p of posts) map.set(p.number, p);
  return map;
}

// Резолв типа поста из БД-карты по номеру (fallback 'light').
function postTypeOf(postsMap, number) {
  return postsMap.get(number)?.type || 'light';
}

// Резолв имени зоны (отображаемого) для поста.
function postZoneOf(postsMap, number) {
  const p = postsMap.get(number);
  if (!p?.zone) return '';
  return p.zone.displayName || p.zone.name || '';
}

// Display-имя поста.
function postDisplayName(postsMap, number) {
  const p = postsMap.get(number);
  return p?.displayName || p?.name || `Пост ${number}`;
}

// Helper: get post status from its work orders
function computePostStatus(wos) {
  const inProgress = wos.find(w => w.status === 'in_progress');
  if (inProgress) return 'active_work';
  const scheduled = wos.find(w => w.status === 'scheduled');
  if (scheduled) return 'occupied_no_work';
  return 'free';
}

// Helper: generate calendar data (last 30 days) for a post
function computeCalendar(postWOs) {
  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    // Weekend — lower load
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayWOs = postWOs.filter(w => {
      const ws = w.scheduledTime || w.startTime;
      return ws && ws.toISOString().slice(0, 10) === dateStr;
    });
    const completed = dayWOs.filter(w => w.status === 'completed').length;
    const totalHours = dayWOs.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    // For days without real data, generate plausible demo values
    const vehicles = dayWOs.length > 0 ? dayWOs.length : (isWeekend ? 0 : Math.floor(2 + Math.random() * 4));
    const hours = totalHours > 0 ? Math.round(totalHours * 10) / 10 : (isWeekend ? 0 : Math.round((2 + Math.random() * 6) * 10) / 10);
    cal.push({
      date: dateStr,
      vehicles,
      completedOrders: dayWOs.length > 0 ? completed : (isWeekend ? 0 : Math.floor(1 + Math.random() * 3)),
      totalHours: hours,
      loadPercent: isWeekend ? 0 : Math.min(100, Math.round((hours / 12) * 100)),
    });
  }
  return cal;
}

// Helper: compute daily analytics (last 7 days) from work orders
function computeDaily(wos) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    const dayWOs = wos.filter(w => {
      const st = w.startTime || w.scheduledTime;
      return st >= dayStart && st <= dayEnd;
    });
    const totalNorm = dayWOs.reduce((s, w) => s + (w.normHours || 0), 0);
    const totalActual = dayWOs.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    const activeH = dayWOs.filter(w => w.status === 'completed' || w.status === 'in_progress')
      .reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);
    days.push({
      date: dateStr,
      occupancy: Math.min(100, Math.round((activeH / 12) * 100 * 10) / 10),
      efficiency: totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0,
      vehicles: dayWOs.length,
      workerPresence: dayWOs.length > 0 ? Math.round(70 + Math.random() * 30) : 0,
      activeHours: Math.round(activeH * 10) / 10,
      idleHours: Math.round(Math.max(0, 12 - activeH) * 10) / 10,
    });
  }
  return days;
}

// Get shift bounds for a given date from settings.
// Все wall-clock времена интерпретируются в settings.timezone (IANA), а не в TZ хоста.
function getShiftBoundsForDate(settings, date) {
  const tz = tzOf(settings);
  const d = date ? new Date(date) : new Date();
  // День недели и YYYY-MM-DD считаем по календарю TZ, а не UTC,
  // иначе при сдвиге часового пояса можем перейти на сутки раньше/позже.
  const dayKey = dayKeyInTz(d, tz);
  const dateStr = dateStrInTz(d, tz);
  const ws = settings.weekSchedule;

  let startStr = '08:00', endStr = '22:00';
  if (ws && ws[dayKey] && !ws[dayKey].dayOff) {
    startStr = ws[dayKey].start || startStr;
    endStr = ws[dayKey].end || endStr;
  } else {
    startStr = settings.shiftStart || '08:00';
    endStr = settings.shiftEnd || '22:00';
  }

  const shiftStart = parseInTz(dateStr, startStr, tz);
  const shiftEnd = parseInTz(dateStr, endStr, tz);
  const maxMs = shiftEnd - shiftStart;
  const maxH = maxMs / 3600000;
  return { shiftStart, shiftEnd, maxMs, maxH, dayOff: !!(ws && ws[dayKey] && ws[dayKey].dayOff) };
}

// Get period date range from query params. Все «сегодня/вчера» считаются
// по календарю TZ из настроек, иначе на UTC-сервере переход дня сдвинут.
function getPeriodRange(period, from, to, settings) {
  const tz = tzOf(settings);
  const now = new Date();
  const todayStr = dateStrInTz(now, tz);
  // Сдвинуть на N календарных дней назад в TZ.
  function shiftDate(baseStr, deltaDays) {
    // Парсим как полночь TZ → корректный UTC момент → прибавляем дни (через UTC, безопасно).
    const startOfDayUtc = parseInTz(baseStr, '00:00', tz);
    const shifted = new Date(startOfDayUtc + deltaDays * 86400000);
    return dateStrInTz(shifted, tz);
  }
  switch (period) {
    case 'yesterday': {
      const ds = shiftDate(todayStr, -1);
      return { dateFrom: ds, dateTo: ds };
    }
    case 'week':
      return { dateFrom: shiftDate(todayStr, -6), dateTo: todayStr };
    case 'month':
      return { dateFrom: shiftDate(todayStr, -29), dateTo: todayStr };
    case 'custom':
      return { dateFrom: from || todayStr, dateTo: to || todayStr };
    default: // today
      return { dateFrom: todayStr, dateTo: todayStr };
  }
}

// GET /api/posts-analytics — per-post analytics from DB
router.get('/posts-analytics', async (req, res) => {
  try {
    // In live mode — return monitoring data
    const curSettings = settingsReader.readSettings();
    const proxy = req.app.get('monitoringProxy');
    const { period, from, to } = req.query;
    const { dateFrom, dateTo } = getPeriodRange(period, from, to, curSettings);
    // Compute daily breakdown from monitoring history.
    // dailyCutoffMs ограничивает «сейчас» для текущего дня (чтобы при потере данных
    // последний столбик не считался по полной смене).
    function computeDailyFromHistory(history, settings, dailyCutoffMs = Date.now()) {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const sb = getShiftBoundsForDate(settings, d);
        const dayHistory = (history || []).filter(h => {
          const ts = new Date(h.timestamp || h.lastUpdate).getTime();
          return ts >= sb.shiftStart && ts <= sb.shiftEnd;
        });
        const m = calcMetricsForBounds(dayHistory, sb, dailyCutoffMs);
        days.push({
          date: d.toISOString().slice(0, 10),
          occupancy: m.loadPercent,
          efficiency: m.efficiency,
          vehicles: dayHistory.filter(h => h.status !== 'free').length,
          workerPresence: dayHistory.some(h => h.peopleCount > 0) ? 100 : 0,
          activeHours: m.workHours,
          idleHours: Math.round(Math.max(0, sb.maxH - m.factHours) * 10) / 10,
        });
      }
      return days;
    }

    // calcMetrics with explicit bounds (for daily breakdown).
    // cutoffMs — верхняя граница «сейчас» (момент последнего реального события CV).
    // Если данных нет — не дотягиваем до Date.now(), иначе посты «работают» весь день
    // даже когда мониторинг лежит.
    function calcMetricsForBounds(history, bounds, cutoffMs = Date.now()) {
      const { shiftStart, shiftEnd, maxMs, maxH } = bounds;
      const now = Math.min(cutoffMs, shiftEnd);
      let occupiedMs = 0, workingMs = 0;
      const sorted = [...(history || [])]
        .filter(h => h.timestamp || h.lastUpdate)
        .sort((a, b) => new Date(a.timestamp || a.lastUpdate) - new Date(b.timestamp || b.lastUpdate));
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const start = new Date(cur.timestamp || cur.lastUpdate).getTime();
        const rawEnd = next ? new Date(next.timestamp || next.lastUpdate).getTime() : now;
        // Защита от «протяжки» через провалы данных: ограничиваем длительность
        // сегмента порогом GAP_THRESHOLD_MS. Если CV молчит >5 мин — состояние
        // «cur» больше не подтверждается и не должно считаться занятостью.
        const end = Math.min(rawEnd, start + GAP_THRESHOLD_MS);
        const cs = Math.max(start, shiftStart);
        const ce = Math.min(end, now);
        const dur = Math.max(0, ce - cs);
        if (dur > 0 && cur.status !== 'free') {
          occupiedMs += dur;
          if (cur.worksInProgress) workingMs += dur;
        }
      }
      occupiedMs = Math.min(occupiedMs, maxMs);
      workingMs = Math.min(workingMs, occupiedMs);
      const factHours = Math.round((occupiedMs / 3600000) * 10) / 10;
      const workHours = Math.round((workingMs / 3600000) * 10) / 10;
      const loadPercent = maxH > 0 ? Math.min(100, Math.round((factHours / maxH) * 100)) : 0;
      const efficiency = occupiedMs > 0 ? Math.min(100, Math.round((workingMs / occupiedMs) * 100)) : 0;
      return { factHours, workHours, loadPercent, efficiency };
    }

    const shiftBounds = getShiftBoundsForDate(curSettings, dateFrom);
    // For multi-day periods, use average shift duration
    if (dateFrom !== dateTo) {
      const d1 = new Date(dateFrom);
      const d2 = new Date(dateTo);
      const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      let totalMs = 0;
      for (let i = 0; i < days; i++) {
        const d = new Date(d1);
        d.setDate(d.getDate() + i);
        const sb = getShiftBoundsForDate(curSettings, d);
        totalMs += sb.maxMs;
      }
      shiftBounds.maxMs = totalMs;
      shiftBounds.maxH = totalMs / 3600000;
      shiftBounds.shiftStart = parseInTz(dateFrom, '00:00', tzOf(curSettings));
      shiftBounds.shiftEnd = parseInTz(dateTo, '23:59', tzOf(curSettings)) + 59000;
    }

    // Calculate occupancy metrics from history timeline within shift bounds.
    // cutoffMs ограничивает «сейчас» моментом последнего реального CV-события.
    function calcMetrics(history, currentStatus, worksInProgress, cutoffMs = Date.now()) {
      const { shiftStart, maxMs, maxH } = shiftBounds;
      const now = Math.min(cutoffMs, shiftBounds.shiftEnd);

      let occupiedMs = 0;
      let workingMs = 0;

      const sorted = [...(history || [])]
        .filter(h => h.timestamp || h.lastUpdate)
        .sort((a, b) => new Date(a.timestamp || a.lastUpdate) - new Date(b.timestamp || b.lastUpdate));

      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const start = new Date(cur.timestamp || cur.lastUpdate).getTime();
        const rawEnd = next ? new Date(next.timestamp || next.lastUpdate).getTime() : now;
        // Per-segment gap guard: если CV молчит дольше GAP_THRESHOLD_MS, считаем
        // что состояние «cur» подтверждено только в пределах этого окна. Иначе
        // одно «occupied» в 09:30 + 10ч молчания = «весь день занят».
        const end = Math.min(rawEnd, start + GAP_THRESHOLD_MS);

        // Clamp to shift window [shiftStart, now]
        const clampedStart = Math.max(start, shiftStart);
        const clampedEnd = Math.min(end, now);
        const dur = Math.max(0, clampedEnd - clampedStart);

        if (dur > 0) {
          if (cur.status !== 'free') {
            occupiedMs += dur;
            if (cur.worksInProgress) workingMs += dur;
          }
        }
      }

      // If currently occupied but no history in window
      if (sorted.length === 0 && currentStatus !== 'free') {
        occupiedMs = 30 * 60 * 1000;
        if (worksInProgress) workingMs = occupiedMs;
      }

      // Cap at max shift duration
      occupiedMs = Math.min(occupiedMs, maxMs);
      workingMs = Math.min(workingMs, occupiedMs);

      const factHours = Math.round((occupiedMs / 3600000) * 10) / 10;
      const workHours = Math.round((workingMs / 3600000) * 10) / 10;
      const loadPercent = Math.min(100, Math.round((factHours / maxH) * 100));
      const efficiency = occupiedMs > 0 ? Math.min(100, Math.round((workingMs / occupiedMs) * 100)) : 0;

      return { factHours, workHours, loadPercent, efficiency };
    }

    if (curSettings.mode === 'live' && proxy && proxy.isRunning()) {
      const postsMap = await getActivePostsMap();
      const monPosts = proxy.getPosts();
      const monZonesPre = (typeof proxy.getFreeZones === 'function') ? proxy.getFreeZones() : [];
      const freshness = computeDataFreshness([...monPosts, ...monZonesPre]);
      const cutoffMs = freshness.dataAsOfMs || 0; // 0 → calcMetrics получит min(0, shiftEnd) = 0, всё схлопнется в 0%
      const result = monPosts.map(mp => {
        const dbPost = postsMap.get(mp.postNumber);
        const history = mp.history || [];
        const occupiedEntries = history.filter(h => h.status === 'occupied' || h.status !== 'free');
        const freeEntries = history.filter(h => h.status === 'free');
        const m = calcMetrics(history, mp.status, mp.worksInProgress, cutoffMs);

        // При stale-данных статус из кэша CV неактуален — отдаём no_data.
        const effectiveStatus = freshness.stale ? 'no_data' : mp.status;
        return {
          id: `post-${mp.postNumber}`,
          number: mp.postNumber,
          name: postDisplayName(postsMap, mp.postNumber),
          displayName: dbPost?.displayName || null,
          displayNameEn: dbPost?.displayNameEn || null,
          type: postTypeOf(postsMap, mp.postNumber),
          zone: mp.externalZoneName,
          status: effectiveStatus,
          maxCapacityHours: shiftBounds.maxH,
          occupancy: m.loadPercent,
          efficiency: m.efficiency,
          vehiclesToday: occupiedEntries.length,
          avgServiceTime: occupiedEntries.length > 0 ? Math.round((m.factHours / occupiedEntries.length) * 10) / 10 : 0,
          totalNormHours: m.factHours,
          totalActualHours: m.workHours,
          completedWOs: freeEntries.length,
          scheduledWOs: 0,
          workerPresence: mp.peopleCount > 0 ? 100 : 0,
          worker: null,
          master: null,
          today: {
            factHours: m.factHours,
            planHours: m.factHours,
            loadPercent: m.loadPercent,
            efficiency: m.efficiency,
            workers: [],
            workOrders: [],
            alerts: [],
            eventLog: history.map((h, i) => ({
              id: `evt-${mp.postNumber}-${i}`,
              timestamp: h.timestamp || h.lastUpdate,
              type: h.status === 'occupied' ? 'post_occupied' : 'post_vacated',
              description: h.worksInProgress ? (h.worksDescription || 'Работы ведутся') : (h.status === 'occupied' ? 'Авто на посту' : 'Пост свободен'),
              plate: h.car?.plate || null,
              car: h.car || null,
              confidence: h.confidence,
              peopleCount: h.peopleCount || 0,
              openParts: h.openParts || [],
            })),
            workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 },
            cameras: [{ id: `cam-post${mp.postNumber}`, name: `Камера пост ${mp.postNumber}`, online: true }],
            currentPlateImage: null,
            // Live-specific fields
            currentVehicle: mp.status !== 'free' ? {
              plateNumber: mp.plateNumber,
              color: mp.carColor,
              model: mp.carModel,
              make: mp.carMake,
              body: mp.carBody,
              firstSeen: mp.carFirstSeen,
            } : null,
            worksDescription: mp.worksDescription,
            peopleCount: mp.peopleCount,
            openParts: mp.openParts,
            confidence: mp.confidence,
          },
          daily: computeDailyFromHistory(history, curSettings, cutoffMs),
          calendar: [],
          workOrders: [],
        };
      });
      // Also add zones
      const monZones = monZonesPre;
      const zones = monZones.map(mz => {
        const history = mz.history || [];
        const occupiedEntries = history.filter(h => h.status === 'occupied' || h.status !== 'free');
        const freeEntries = history.filter(h => h.status === 'free');
        const m = calcMetrics(history, mz.status, mz.worksInProgress, cutoffMs);

        const effectiveZoneStatus = freshness.stale
          ? 'no_data'
          : (mz.status === 'occupied' ? (mz.worksInProgress ? 'active_work' : 'occupied') : 'free');
        return {
          id: `zone-${mz.zoneNumber}`,
          number: mz.zoneNumber,
          name: `Зона ${String(mz.zoneNumber).padStart(2, '0')}`,
          type: 'zone',
          zone: mz.externalZoneName,
          status: effectiveZoneStatus,
          maxCapacityHours: shiftBounds.maxH,
          occupancy: m.loadPercent,
          efficiency: m.efficiency,
          vehiclesToday: occupiedEntries.length,
          avgServiceTime: occupiedEntries.length > 0 ? Math.round((m.factHours / occupiedEntries.length) * 10) / 10 : 0,
          totalNormHours: m.factHours,
          totalActualHours: m.workHours,
          completedWOs: freeEntries.length,
          scheduledWOs: 0,
          workerPresence: mz.peopleCount > 0 ? 100 : 0,
          worker: null,
          master: null,
          today: {
            factHours: m.factHours,
            planHours: m.factHours,
            loadPercent: m.loadPercent,
            efficiency: m.efficiency,
            workers: [],
            workOrders: [],
            alerts: [],
            eventLog: history.map((h, i) => ({
              id: `evt-z${mz.zoneNumber}-${i}`,
              timestamp: h.timestamp || h.lastUpdate,
              type: h.status === 'occupied' ? 'post_occupied' : 'post_vacated',
              description: h.worksInProgress ? (h.worksDescription || 'Работы ведутся') : (h.status === 'occupied' ? 'Авто в зоне' : 'Зона свободна'),
              plate: h.car?.plate || null,
              car: h.car || null,
              confidence: h.confidence,
              peopleCount: h.peopleCount || 0,
              openParts: h.openParts || [],
            })),
            workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 },
            cameras: [],
            currentVehicle: mz.status === 'occupied' ? {
              plateNumber: mz.plateNumber,
              color: mz.carColor,
              model: mz.carModel,
              make: mz.carMake,
              body: mz.carBody,
              firstSeen: mz.carFirstSeen,
            } : null,
            worksDescription: mz.worksDescription,
            peopleCount: mz.peopleCount,
            openParts: mz.openParts,
            confidence: mz.confidence,
          },
          daily: computeDailyFromHistory(history, curSettings, cutoffMs),
          calendar: [],
          workOrders: [],
        };
      });

      // Добавляем посты, которые есть в БД, но не репортятся CV-системой:
      // sidebar и аналитика должны их видеть, чтобы пользователь знал, что они существуют.
      const seenNumbers = new Set(result.map(r => r.number));
      for (const [num, dbPost] of postsMap) {
        if (seenNumbers.has(num)) continue;
        result.push({
          id: `post-${num}`,
          number: num,
          name: dbPost.displayName || dbPost.name || `Пост ${num}`,
          displayName: dbPost.displayName || null,
          displayNameEn: dbPost.displayNameEn || null,
          type: dbPost.type || 'light',
          zone: dbPost.zone?.displayName || dbPost.zone?.name || '',
          status: 'no_data',
          maxCapacityHours: shiftBounds.maxH,
          occupancy: 0,
          efficiency: 0,
          vehiclesToday: 0,
          avgServiceTime: 0,
          totalNormHours: 0,
          totalActualHours: 0,
          completedWOs: 0,
          scheduledWOs: 0,
          workerPresence: 0,
          worker: null,
          master: null,
          today: {
            factHours: 0, planHours: 0, loadPercent: 0, efficiency: 0,
            workers: [], workOrders: [], alerts: [], eventLog: [],
            workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 },
            cameras: [], currentPlateImage: null, currentVehicle: null,
            worksDescription: null, peopleCount: 0, openParts: [], confidence: null,
          },
          daily: [], calendar: [], workOrders: [],
        });
      }
      result.sort((a, b) => a.number - b.number);

      return res.json({
        posts: result,
        zones,
        mode: 'live',
        dataAsOf: freshness.dataAsOf,
        dataAgeMs: freshness.dataAgeMs,
        stale: freshness.stale,
        staleThresholdMs: STALE_DATA_MS,
      });
    }

    const posts = await prisma.post.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const allWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'asc' },
    });

    // Find the most recent day with multiple WOs
    const latestWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'desc' },
      take: 50,
      select: { scheduledTime: true },
    });
    let refDate = new Date();
    const dayCounts = {};
    for (const w of latestWOs) {
      const day = w.scheduledTime.toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count >= 2) { refDate = new Date(day + 'T12:00:00'); break; }
    }
    const refDayStart = new Date(refDate); refDayStart.setHours(0, 0, 0, 0);

    const postsMap = await getActivePostsMap();
    const result = [];
    for (const num of postsMap.keys()) {
      const postWOs = allWOs.filter(w => w.postNumber === num);
      const todayWOs = postWOs.filter(w => (w.startTime || w.scheduledTime) >= refDayStart);
      const completedToday = todayWOs.filter(w => w.status === 'completed');
      const scheduledToday = todayWOs.filter(w => w.status === 'scheduled');
      const inProgress = postWOs.find(w => w.status === 'in_progress');
      const totalNorm = todayWOs.reduce((s, w) => s + (w.normHours || 0), 0);
      const totalActual = completedToday.reduce((s, w) => s + (w.actualHours || w.normHours || 0), 0);

      // Find worker/master from most recent WO
      const recentWO = postWOs.filter(w => w.worker).slice(-1)[0];

      const planHours = Math.round(totalNorm * 10) / 10;
      const factHours = Math.round(totalActual * 10) / 10;
      const loadPercent = Math.min(100, Math.round((factHours / shiftBounds.maxH) * 100));

      // Build workers list from today's WOs
      const workersMap = {};
      for (const w of todayWOs) {
        if (w.worker && !workersMap[w.worker]) {
          workersMap[w.worker] = { name: w.worker, role: 'mechanic', normHours: 0 };
        }
        if (w.worker) workersMap[w.worker].normHours += (w.normHours || 0);
      }
      const workers = Object.values(workersMap).map(w => ({
        ...w, normHours: Math.round(w.normHours * 10) / 10,
      }));

      // Work orders for today section
      const todayWorkOrders = todayWOs.map(w => ({
        id: w.id, orderNumber: w.orderNumber, plateNumber: w.plateNumber,
        brand: w.brand, model: w.model, workType: w.workType,
        normHours: w.normHours, actualHours: w.actualHours,
        status: w.status, startTime: w.startTime, endTime: w.endTime,
        worker: w.worker, master: w.master,
      }));

      // Build workStats
      const groupMap = {};
      const brandMap = {};
      for (const w of todayWOs) {
        const g = w.workType || 'Прочее';
        if (!groupMap[g]) groupMap[g] = { group: g, hours: 0, count: 0 };
        groupMap[g].hours += (w.normHours || 0);
        groupMap[g].count++;
        const b = w.brand || 'Неизвестно';
        if (!brandMap[b]) brandMap[b] = { brand: b, count: 0 };
        brandMap[b].count++;
      }
      const byGroup = Object.values(groupMap).map(g => ({ ...g, hours: Math.round(g.hours * 10) / 10 }));
      const byBrand = Object.values(brandMap);
      const avgTimePerOrder = todayWOs.length > 0
        ? Math.round((factHours / todayWOs.length) * 10) / 10 : 0;

      const today = {
        factHours,
        planHours,
        loadPercent,
        workers,
        workOrders: todayWorkOrders,
        alerts: [],
        eventLog: [],
        workStats: { byGroup, byBrand, avgTimePerOrder, total: todayWOs.length },
        cameras: [
          { id: `cam-post${num}`, name: `Камера пост ${num}`, online: true },
        ],
        currentPlateImage: null,
      };

      const dbPostForRow = postsMap.get(num);
      result.push({
        id: `post-${num}`,
        number: num,
        name: postDisplayName(postsMap, num),
        displayName: dbPostForRow?.displayName || null,
        displayNameEn: dbPostForRow?.displayNameEn || null,
        type: postTypeOf(postsMap, num),
        zone: postZoneOf(postsMap, num),
        status: computePostStatus(todayWOs),
        maxCapacityHours: shiftBounds.maxH,
        today,
        occupancy: loadPercent,
        efficiency: totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0,
        vehiclesToday: todayWOs.length,
        avgServiceTime: completedToday.length > 0
          ? Math.round((totalActual / completedToday.length) * 10) / 10 : 0,
        totalNormHours: planHours,
        totalActualHours: factHours,
        completedWOs: completedToday.length,
        scheduledWOs: scheduledToday.length,
        workerPresence: todayWOs.length > 0 ? Math.round(70 + Math.random() * 30) : 0,
        worker: recentWO?.worker || null,
        master: recentWO?.master || null,
        daily: computeDaily(postWOs),
        calendar: computeCalendar(postWOs),
        workOrders: postWOs.slice(-20).map(w => ({
          id: w.id, orderNumber: w.orderNumber, plateNumber: w.plateNumber,
          brand: w.brand, model: w.model, workType: w.workType,
          normHours: w.normHours, actualHours: w.actualHours,
          status: w.status, startTime: w.startTime, endTime: w.endTime,
          worker: w.worker, master: w.master,
        })),
      });
    }

    // Add zones for demo mode — берём все активные не-deleted зоны из БД
    const dbZones = await prisma.zone.findMany({
      where: { deleted: false, isActive: true },
      include: { _count: { select: { stays: { where: { exitTime: null } } } } },
      orderBy: { name: 'asc' },
    });
    const zones = [];
    for (const dbZ of dbZones) {
      const num = parseInt(dbZ.name?.match(/\d+/)?.[0], 10) || (zones.length + 1);
      zones.push({
        id: `zone-${dbZ.id}`,
        number: num,
        name: dbZ.displayName || dbZ.name,
        type: 'zone',
        zone: dbZ.name,
        status: dbZ._count?.stays > 0 ? 'occupied' : 'free',
        maxCapacityHours: shiftBounds.maxH,
        occupancy: 0,
        efficiency: 0,
        vehiclesToday: 0,
        avgServiceTime: 0,
        totalNormHours: 0, totalActualHours: 0,
        completedWOs: 0, scheduledWOs: 0,
        workerPresence: 0, worker: null, master: null,
        today: { factHours: 0, planHours: 0, loadPercent: 0, workers: [], workOrders: [], alerts: [], eventLog: [], workStats: { byGroup: [], byBrand: [], avgTimePerOrder: 0, total: 0 }, cameras: [], currentVehicle: null, worksDescription: null, peopleCount: 0, openParts: [], confidence: null },
        daily: [], calendar: [], workOrders: [],
      });
    }

    res.json({ posts: result, zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard-posts — timeline data for posts Gantt view
router.get('/dashboard-posts', async (req, res) => {
  try {
    // In live mode — return data from monitoring proxy
    const settings = settingsReader.readSettings();
    const shiftBounds = getShiftBoundsForDate(settings);
    const proxy = req.app.get('monitoringProxy');
    if (settings.mode === 'live' && proxy && proxy.isRunning()) {
      const postsMap = await getActivePostsMap();
      const monPosts = proxy.getPosts();
      const monZonesPre = (typeof proxy.getFreeZones === 'function') ? proxy.getFreeZones() : [];
      const freshness = computeDataFreshness([...monPosts, ...monZonesPre]);
      // На сколько мы вправе тянуть «активные» блоки таймлайна вправо. Если данные
      // несвежие — не дотягиваем до now: визит должен закрыться на момент последнего
      // реального события CV.
      const timelineNowMs = freshness.dataAsOfMs
        ? Math.min(Date.now(), freshness.dataAsOfMs)
        : Date.now();
      const timelineNowIso = new Date(timelineNowMs).toISOString();
      const posts = monPosts.map(mp => {
        const dbPost = postsMap.get(mp.postNumber);
        // Сворачиваем сырые snapshot-ы в «визиты» (один блок на одного авто на посту).
        // Без этого на каждый snapshot создавался бы блок таймлайна, и /api/dashboard-posts
        // отдавал бы тысячи записей за одну смену → дашборд становился неповоротливым,
        // а каждый snapshot со status='free' попадал в счётчик «Выполнено ЗН» (16k+).
        // Фильтруем snapshot-ы границами текущей смены.
        const allHistory = Array.isArray(mp.history) ? mp.history : [];
        const inShift = allHistory.filter(h => {
          const ts = new Date(h.timestamp).getTime();
          return ts >= shiftBounds.shiftStart && ts <= shiftBounds.shiftEnd;
        }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const timeline = [];
        let visit = null;
        let prevTs = null;
        for (const h of inShift) {
          const curTs = new Date(h.timestamp).getTime();
          // Если между прошлой и текущей записью — провал (>5 мин), значит CV
          // молчал. Открытый визит закрываем по последнему подтверждённому
          // кадру, а не «протягиваем» через провал. Иначе один кадр «occupied»
          // даёт визит длиной во весь outage.
          if (visit && prevTs && (curTs - prevTs) > GAP_THRESHOLD_MS) {
            timeline.push({ ...visit, endTime: new Date(prevTs).toISOString(), completed: true });
            visit = null;
          }
          if (h.status !== 'free') {
            // Начало визита или продолжение
            if (!visit) {
              visit = {
                start: h.timestamp,
                end: h.timestamp,
                plate: h.car?.plate || null,
                brand: h.car?.make || null,
                model: h.car?.model || null,
                worksInProgress: !!h.worksInProgress,
                worksDescription: h.worksDescription || null,
                peopleCount: h.peopleCount || 0,
                confidence: h.confidence,
              };
            } else {
              visit.end = h.timestamp;
              visit.worksInProgress = visit.worksInProgress || !!h.worksInProgress;
              visit.peopleCount = Math.max(visit.peopleCount, h.peopleCount || 0);
              if (h.worksDescription) visit.worksDescription = h.worksDescription;
            }
          } else if (visit) {
            // Конец визита — закрываем блок (status='completed', endTime = первый free)
            timeline.push({ ...visit, endTime: h.timestamp, completed: true });
            visit = null;
          }
          prevTs = curTs;
        }
        // Открытый визит на момент конца смены/сейчас → in_progress / scheduled.
        // Когда данные несвежие или последний кадр старше GAP_THRESHOLD_MS —
        // не дотягиваем визит до настоящего "сейчас", закрываем по prevTs.
        if (visit) {
          const isLastFresh = prevTs && (timelineNowMs - prevTs) <= GAP_THRESHOLD_MS;
          if (isLastFresh) {
            timeline.push({ ...visit, endTime: null, completed: false });
          } else if (prevTs) {
            timeline.push({ ...visit, endTime: new Date(prevTs).toISOString(), completed: true });
          }
        } else if (!freshness.stale && mp.status && mp.status !== 'free' && mp.status !== 'no_data') {
          // Sync-fallback: текущее состояние = занят, но в истории последний кадр
          // оказался 'free' (расхождение CV/полла). Используем только когда данные
          // свежие — иначе мы рисуем призрак на момент часовой давности.
          const lastClosed = timeline[timeline.length - 1];
          const fallbackStart = lastClosed?.endTime
            || mp.lastUpdate
            || new Date(timelineNowMs - 60_000).toISOString();
          timeline.push({
            start: fallbackStart,
            end: timelineNowIso,
            plate: mp.plateNumber || null,
            brand: mp.carMake || null,
            model: mp.carModel || null,
            worksInProgress: !!mp.worksInProgress,
            worksDescription: mp.worksDescription || null,
            peopleCount: mp.peopleCount || 0,
            confidence: mp.confidence,
            endTime: null,
            completed: false,
          });
        }

        // Маппинг визитов в формат таймлайна.
        // В live-режиме у нас от CV только два сигнала: была работа или нет.
        // - была работа в визите → 'in_progress' (фиолетовый = "обслуживание шло")
        // - авто стояло без работ → 'scheduled' (серый = "просто стояло")
        // Зелёный 'completed' не используем — мы не знаем, был ли визит закрытием ЗН;
        // зелёный остаётся для свободных промежутков (gap между визитами).
        const tlBlocks = timeline.map((v, idx) => ({
          id: `mon-${mp.postNumber}-${idx}`,
          workOrderNumber: null,
          workOrderId: null,
          plateNumber: v.plate,
          brand: v.brand,
          model: v.model,
          workType: v.worksInProgress ? 'monitoring' : null,
          // Палитра карты СТО (constants/index.js):
          //   completed (зелёный)   — визит закрыт, работы были
          //   active_work (индиго)  — визит идёт, работы идут
          //   occupied (оранжевый)  — визит идёт, работ нет (просто стоит)
          //   scheduled (серый)     — визит закрыт без работ (стоял мимоходом)
          status: v.completed
            ? (v.worksInProgress ? 'completed' : 'scheduled')
            : (v.worksInProgress ? 'active_work' : 'occupied'),
          startTime: v.start,
          endTime: v.endTime,
          normHours: null,
          master: null,
          worker: null,
          actualHours: null,
          estimatedEnd: null,
          confidence: v.confidence,
          peopleCount: v.peopleCount,
          worksDescription: v.worksDescription,
          // Технические флаги для аналитики (не на рендер):
          visitClosed: v.completed,
          hadWork: v.worksInProgress,
        }));

        // При stale-данных текущий статус из кэша CV неактуален: статус мог
        // поменяться много раз за час молчания. Возвращаем 'no_data' и не светим
        // currentVehicle, чтобы KPI-карточки не показывали ложную занятость.
        const effectiveStatus = freshness.stale ? 'no_data' : mp.status;
        const currentVehicle = !freshness.stale && mp.status !== 'free' && (mp.plateNumber || mp.carModel)
          ? { plateNumber: mp.plateNumber, brand: mp.carMake, model: mp.carModel, color: mp.carColor }
          : null;

        return {
          id: `post-${mp.postNumber}`,
          number: mp.postNumber,
          name: postDisplayName(postsMap, mp.postNumber),
          displayName: dbPost?.displayName || null,
          displayNameEn: dbPost?.displayNameEn || null,
          type: postTypeOf(postsMap, mp.postNumber),
          zone: mp.externalZoneName,
          status: effectiveStatus,
          currentVehicle,
          worksDescription: freshness.stale ? null : mp.worksDescription,
          peopleCount: freshness.stale ? 0 : mp.peopleCount,
          openParts: freshness.stale ? [] : mp.openParts,
          confidence: freshness.stale ? null : mp.confidence,
          lastUpdate: mp.lastUpdate,
          timeline: tlBlocks,
          freeWorkOrders: [],
        };
      });

      // Добавляем посты, известные БД, но отсутствующие в monitoring (status=no_data)
      const seenNums = new Set(posts.map(p => p.number));
      for (const [num, dbPost] of postsMap) {
        if (seenNums.has(num)) continue;
        posts.push({
          id: `post-${num}`,
          number: num,
          name: dbPost.displayName || dbPost.name || `Пост ${num}`,
          displayName: dbPost.displayName || null,
          displayNameEn: dbPost.displayNameEn || null,
          type: dbPost.type || 'light',
          kind: 'post',
          zone: dbPost.zone?.displayName || dbPost.zone?.name || '',
          status: 'no_data',
          currentVehicle: null,
          worksDescription: null,
          peopleCount: 0,
          openParts: [],
          confidence: null,
          lastUpdate: null,
          timeline: [],
          freeWorkOrders: [],
        });
      }
      posts.sort((a, b) => a.number - b.number);
      // Все посты помечаем kind='post' (если ещё не выставлено выше для no_data)
      posts.forEach(p => { if (!p.kind) p.kind = 'post'; });

      // ── Зоны: строим строки по тому же принципу, что и посты ──
      // Источник: monitoringProxy.getFreeZones() — данные из CV-системы.
      // Дополнительно добираем зоны из БД (isActive=true), которых нет в мониторинге → status=no_data.
      const monZones = monZonesPre;
      const zoneRows = monZones.map(mz => {
        const allHistory = Array.isArray(mz.history) ? mz.history : [];
        const inShift = allHistory.filter(h => {
          const ts = new Date(h.timestamp).getTime();
          return ts >= shiftBounds.shiftStart && ts <= shiftBounds.shiftEnd;
        }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const timeline = [];
        let visit = null;
        let prevTs = null;
        for (const h of inShift) {
          const curTs = new Date(h.timestamp).getTime();
          if (visit && prevTs && (curTs - prevTs) > GAP_THRESHOLD_MS) {
            timeline.push({ ...visit, endTime: new Date(prevTs).toISOString(), completed: true });
            visit = null;
          }
          if (h.status !== 'free') {
            if (!visit) {
              visit = {
                start: h.timestamp, end: h.timestamp,
                plate: h.car?.plate || null,
                brand: h.car?.make || null,
                model: h.car?.model || null,
                worksInProgress: !!h.worksInProgress,
                worksDescription: h.worksDescription || null,
                peopleCount: h.peopleCount || 0,
                confidence: h.confidence,
              };
            } else {
              visit.end = h.timestamp;
              visit.worksInProgress = visit.worksInProgress || !!h.worksInProgress;
              visit.peopleCount = Math.max(visit.peopleCount, h.peopleCount || 0);
              if (h.worksDescription) visit.worksDescription = h.worksDescription;
            }
          } else if (visit) {
            timeline.push({ ...visit, endTime: h.timestamp, completed: true });
            visit = null;
          }
          prevTs = curTs;
        }
        if (visit) {
          const isLastFresh = prevTs && (timelineNowMs - prevTs) <= GAP_THRESHOLD_MS;
          if (isLastFresh) {
            timeline.push({ ...visit, endTime: null, completed: false });
          } else if (prevTs) {
            timeline.push({ ...visit, endTime: new Date(prevTs).toISOString(), completed: true });
          }
        } else if (!freshness.stale && mz.status && mz.status !== 'free' && mz.status !== 'no_data') {
          // Sync-fallback (см. посты выше): зона занята «сейчас», но в истории нет
          // открытого визита. Только при свежих данных.
          const lastClosed = timeline[timeline.length - 1];
          const fallbackStart = lastClosed?.endTime
            || mz.lastUpdate
            || new Date(timelineNowMs - 60_000).toISOString();
          timeline.push({
            start: fallbackStart,
            end: timelineNowIso,
            plate: mz.plateNumber || null,
            brand: mz.carMake || null,
            model: mz.carModel || null,
            worksInProgress: !!mz.worksInProgress,
            worksDescription: mz.worksDescription || null,
            peopleCount: mz.peopleCount || 0,
            confidence: mz.confidence,
            endTime: null,
            completed: false,
          });
        }

        const tlBlocks = timeline.map((v, idx) => ({
          id: `mon-zone-${mz.zoneNumber}-${idx}`,
          workOrderNumber: null,
          workOrderId: null,
          plateNumber: v.plate,
          brand: v.brand,
          model: v.model,
          workType: v.worksInProgress ? 'monitoring' : null,
          // Палитра карты СТО (см. посты выше).
          status: v.completed
            ? (v.worksInProgress ? 'completed' : 'scheduled')
            : (v.worksInProgress ? 'active_work' : 'occupied'),
          startTime: v.start,
          endTime: v.endTime,
          normHours: null,
          master: null, worker: null,
          actualHours: null, estimatedEnd: null,
          confidence: v.confidence,
          peopleCount: v.peopleCount,
          worksDescription: v.worksDescription,
          visitClosed: v.completed,
          hadWork: v.worksInProgress,
        }));

        const currentVehicle = !freshness.stale && mz.status !== 'free' && (mz.plateNumber || mz.carModel)
          ? { plateNumber: mz.plateNumber, brand: mz.carMake, model: mz.carModel, color: mz.carColor }
          : null;
        const effectiveZoneStatus = freshness.stale
          ? 'no_data'
          : (mz.status === 'occupied' ? (mz.worksInProgress ? 'active_work' : 'occupied') : (mz.status || 'free'));

        return {
          id: `zone-${mz.zoneNumber}`,
          number: mz.zoneNumber,
          name: `Зона ${String(mz.zoneNumber).padStart(2, '0')}`,
          type: 'free',
          kind: 'zone',
          zone: mz.externalZoneName,
          // Единая палитра карты СТО: зона с работами → active_work (индиго),
          // просто занята → occupied (оранжевый), свободна → free (зелёный).
          // При stale-данных всё → no_data.
          status: effectiveZoneStatus,
          worksInProgress: freshness.stale ? false : !!mz.worksInProgress,
          currentVehicle,
          worksDescription: freshness.stale ? null : mz.worksDescription,
          peopleCount: freshness.stale ? 0 : mz.peopleCount,
          openParts: freshness.stale ? [] : mz.openParts,
          confidence: freshness.stale ? null : mz.confidence,
          lastUpdate: mz.lastUpdate,
          timeline: tlBlocks,
          freeWorkOrders: [],
        };
      });

      // Зоны из БД, не пришедшие в мониторинге → no_data
      try {
        const dbZones = await prisma.zone.findMany({
          where: { isActive: true },
          select: { id: true, name: true, displayName: true, type: true },
        });
        const seenZ = new Set(zoneRows.map(z => z.number));
        for (const z of dbZones) {
          // Только нумерованные «Зона N» — пропускаем «Ремонтная зона...» и т.п.
          const m = z.name?.match(/^Зона\s+(\d+)$/);
          const num = m ? parseInt(m[1], 10) : null;
          if (!num || seenZ.has(num)) continue;
          zoneRows.push({
            id: `zone-${num}`,
            number: num,
            name: z.displayName || `Зона ${String(num).padStart(2, '0')}`,
            type: z.type || 'free',
            kind: 'zone',
            zone: z.name,
            status: 'no_data',
            currentVehicle: null,
            worksDescription: null,
            peopleCount: 0,
            openParts: [],
            confidence: null,
            lastUpdate: null,
            timeline: [],
            freeWorkOrders: [],
          });
        }
      } catch {}
      zoneRows.sort((a, b) => a.number - b.number);
      posts.push(...zoneRows);

      // Реальные ЗН (1С → WorkOrder в БД) за текущую смену.
      // Визиты CV ≠ ЗН: визит — это машина на посту, ЗН — это документ из 1С.
      // Счётчик «Выполнено ЗН» должен брать ЗН, а не визиты.
      const shiftStartDate = new Date(shiftBounds.shiftStart);
      const shiftEndDate = new Date(shiftBounds.shiftEnd);
      const shiftWOs = await prisma.workOrder.findMany({
        where: { scheduledTime: { gte: shiftStartDate, lte: shiftEndDate } },
        select: { status: true, normHours: true, actualHours: true, startTime: true, endTime: true },
      });
      const woStats = {
        completed: shiftWOs.filter(w => w.status === 'completed').length,
        inProgress: shiftWOs.filter(w => w.status === 'in_progress').length,
        scheduled: shiftWOs.filter(w => w.status === 'scheduled').length,
        totalNormHours: shiftWOs.reduce((s, w) => s + (w.normHours || 0), 0),
        totalActualHours: shiftWOs.reduce((s, w) => s + (w.actualHours || 0), 0),
        savedMinutes: shiftWOs.reduce((s, w) => {
          if (w.status === 'completed' && w.actualHours != null && w.normHours != null && w.normHours > w.actualHours) {
            return s + (w.normHours - w.actualHours) * 60;
          }
          return s;
        }, 0),
      };

      return res.json({
        settings: { shiftStart: settings.shiftStart || '08:00', shiftEnd: settings.shiftEnd || '22:00', postsCount: settings.postsCount || postsMap.size, weekSchedule: settings.weekSchedule, timezone: tzOf(settings), mode: 'live' },
        posts,
        freeWorkOrders: [],
        workOrdersStats: woStats,
        dataAsOf: freshness.dataAsOf,
        dataAgeMs: freshness.dataAgeMs,
        stale: freshness.stale,
        staleThresholdMs: STALE_DATA_MS,
      });
    }

    // Demo mode — original DB logic
    // Find the most recent day with multiple WOs (skip single orphan records)
    const latestWOs = await prisma.workOrder.findMany({
      orderBy: { scheduledTime: 'desc' },
      take: 50,
      select: { scheduledTime: true },
    });
    // Find first day that has >= 2 records
    let refDate = new Date();
    const dayCounts = {};
    for (const w of latestWOs) {
      const day = w.scheduledTime.toISOString().slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count >= 2) { refDate = new Date(day + 'T12:00:00'); break; }
    }
    const dayStart = new Date(refDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(refDate); dayEnd.setHours(23, 59, 59, 999);

    const allWOs = await prisma.workOrder.findMany({
      where: {
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const freeWOs = await prisma.workOrder.findMany({
      where: {
        status: 'scheduled',
        postNumber: null,
      },
      orderBy: { scheduledTime: 'asc' },
      take: 10,
    });

    const dbPostsMap = await getActivePostsMap();
    const posts = [];
    for (const num of dbPostsMap.keys()) {
      const postWOs = allWOs.filter(w => w.postNumber === num);
      const inProgress = postWOs.find(w => w.status === 'in_progress');
      const status = computePostStatus(postWOs);

      let currentVehicle = null;
      if (inProgress && inProgress.plateNumber) {
        currentVehicle = {
          plateNumber: inProgress.plateNumber,
          brand: inProgress.brand,
          model: inProgress.model,
        };
      }

      const dbPostForDash = dbPostsMap.get(num);
      posts.push({
        id: `post-${num}`,
        number: num,
        name: postDisplayName(dbPostsMap, num),
        displayName: dbPostForDash?.displayName || null,
        displayNameEn: dbPostForDash?.displayNameEn || null,
        type: postTypeOf(dbPostsMap, num),
        kind: 'post',
        zone: postZoneOf(dbPostsMap, num),
        status,
        currentVehicle,
        timeline: postWOs.map(w => ({
          id: `tl-${num}-${w.orderNumber}`,
          workOrderNumber: w.orderNumber,
          workOrderId: w.id,
          plateNumber: w.plateNumber,
          brand: w.brand,
          model: w.model,
          workType: w.workType,
          status: w.status,
          startTime: w.startTime || w.scheduledTime,
          endTime: w.endTime,
          normHours: w.normHours,
          master: w.master,
          worker: w.worker,
          actualHours: w.actualHours,
          estimatedEnd: w.estimatedEnd,
        })),
        freeWorkOrders: num === 1 ? freeWOs.map(w => ({
          id: w.id,
          workOrderNumber: w.orderNumber,
          plateNumber: w.plateNumber,
          brand: w.brand,
          model: w.model,
          workType: w.workType,
          normHours: w.normHours,
        })) : [],
      });
    }

    // ── Зоны (demo): только нумерованные «Зона N», без таймлайна ──
    try {
      const dbZones = await prisma.zone.findMany({
        where: { isActive: true },
        select: { name: true, displayName: true, type: true },
      });
      const zoneRows = [];
      for (const z of dbZones) {
        const m = z.name?.match(/^Зона\s+(\d+)$/);
        const num = m ? parseInt(m[1], 10) : null;
        if (!num) continue;
        zoneRows.push({
          id: `zone-${num}`,
          number: num,
          name: z.displayName || `Зона ${String(num).padStart(2, '0')}`,
          type: z.type || 'free',
          kind: 'zone',
          zone: z.name,
          status: 'free',
          currentVehicle: null,
          timeline: [],
          freeWorkOrders: [],
        });
      }
      zoneRows.sort((a, b) => a.number - b.number);
      posts.push(...zoneRows);
    } catch {}

    res.json({
      settings: { shiftStart: settings.shiftStart || '08:00', shiftEnd: settings.shiftEnd || '22:00', postsCount: settings.postsCount || dbPostsMap.size, weekSchedule: settings.weekSchedule, timezone: tzOf(settings), mode: 'db' },
      posts,
      freeWorkOrders: freeWOs.map(w => ({
        id: w.id,
        workOrderNumber: w.orderNumber,
        plateNumber: w.plateNumber,
        brand: w.brand,
        model: w.model,
        workType: w.workType,
        normHours: w.normHours,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRUD for work orders ──

// GET /api/work-orders-crud — list with filters
router.get('/work-orders-crud', async (req, res) => {
  try {
    const { postNumber, status, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (postNumber) where.postNumber = parseInt(postNumber, 10);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        orderBy: { scheduledTime: 'desc' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.workOrder.count({ where }),
    ]);

    res.json({ items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/work-orders-crud/:id — update work order
router.put('/work-orders-crud/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      orderNumber, status, plateNumber, workType, normHours, actualHours,
      brand, model, worker, master, postNumber, startTime, endTime, estimatedEnd,
    } = req.body;

    const data = {};
    if (orderNumber !== undefined) data.orderNumber = orderNumber;
    if (status !== undefined) data.status = status;
    if (plateNumber !== undefined) data.plateNumber = plateNumber;
    if (workType !== undefined) data.workType = workType;
    if (normHours !== undefined) data.normHours = normHours;
    if (actualHours !== undefined) data.actualHours = actualHours;
    if (brand !== undefined) data.brand = brand;
    if (model !== undefined) data.model = model;
    if (worker !== undefined) data.worker = worker;
    if (master !== undefined) data.master = master;
    if (postNumber !== undefined) data.postNumber = postNumber;
    if (startTime !== undefined) data.startTime = startTime ? new Date(startTime) : null;
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (estimatedEnd !== undefined) data.estimatedEnd = estimatedEnd ? new Date(estimatedEnd) : null;

    const updated = await prisma.workOrder.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders-crud — create work order
router.post('/work-orders-crud', async (req, res) => {
  try {
    const {
      orderNumber, status = 'scheduled', plateNumber, workType, normHours,
      actualHours, brand, model, worker, master, postNumber, startTime, endTime,
    } = req.body;

    if (!orderNumber) return res.status(400).json({ error: 'orderNumber is required' });

    const scheduledTime = startTime ? new Date(startTime) : new Date();
    const estimatedEnd = endTime ? new Date(endTime) : (normHours
      ? new Date(scheduledTime.getTime() + normHours * 3600000) : null);

    const wo = await prisma.workOrder.create({
      data: {
        orderNumber, scheduledTime, status, plateNumber, workType,
        normHours: normHours || null, actualHours: actualHours || null,
        brand, model, worker, master,
        postNumber: postNumber || null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        estimatedEnd,
      },
    });

    res.status(201).json(wo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/work-orders-crud/:id
router.delete('/work-orders-crud/:id', async (req, res) => {
  try {
    // Delete links first
    await prisma.workOrderLink.deleteMany({ where: { workOrderId: req.params.id } });
    await prisma.workOrder.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/analytics-history — 30-day per-post analytics ───
// Generated deterministically (seeded random) so it's consistent within a day.
router.get('/analytics-history', async (req, res) => {
  try {
    const crypto = require('crypto');
    function uuidSeed(seed) {
      return crypto.createHash('md5').update(String(seed)).digest('hex');
    }

    const MOSCOW_OFFSET_MS = 3 * 60 * 60000;
    const _now = new Date();
    const NOW = new Date(_now.getTime() + (MOSCOW_OFFSET_MS + _now.getTimezoneOffset() * 60000));
    const TODAY_BASE = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

    let _s = Math.floor(TODAY_BASE.getTime() / 86400000);
    function sr() { _s = (_s * 16807 + 0) % 2147483647; return (_s - 1) / 2147483646; }
    function rb(min, max) { return min + sr() * (max - min); }
    function rt(n, d = 1) { return Math.round(n * (10 ** d)) / (10 ** d); }

    const WORKERS_NAMES = [
      'Павлович Сергей Леонидович', 'Романовский Денис Сергеевич',
      'Филипеня Павел Григорьевич', 'Кондратенко Андрей Станиславович',
      'Бортник Ярослав Константинович', 'Кендыш Александр Иванович',
      'Швец Алексей Богданович', 'Воропай Александр Антонович',
      'Бобров Александр Владимирович', 'Косачук Антон Николаевич',
    ];
    const MASTERS_NAMES = ['Крылатов Максим Геннадьевич', 'Эксузьян Андроник Андроникович', 'Прижилуцкий Юрий Анатольевич'];

    function hourlyLoadBase(h, isWeekend) {
      const curve = { 8: 0.35, 9: 0.55, 10: 0.78, 11: 0.85, 12: 0.75, 13: 0.55, 14: 0.72, 15: 0.80, 16: 0.70, 17: 0.55, 18: 0.40, 19: 0.25 };
      return (curve[h] || 0.3) * (isWeekend ? 0.4 : 1.0);
    }

    // Список постов из БД (источник истины: MapLayout → mapSyncService).
    const dbPosts = await prisma.post.findMany({
      where: { deleted: false, number: { not: null } },
      orderBy: { number: 'asc' },
      select: { number: true, type: true, displayName: true, displayNameEn: true, name: true },
    });

    const posts = dbPosts.map((dbPost, pi) => {
      const trait = {
        occBase: 0.55 + (pi % 3) * 0.1,
        effBase: 0.60 + ((pi + 1) % 4) * 0.08,
        vehicleBase: pi < 8 ? 4 : 3,
      };
      const num = dbPost.number;
      const days = [];

      for (let d = 29; d >= 0; d--) {
        const day = new Date(TODAY_BASE);
        day.setDate(day.getDate() - d);
        const dateStr = day.toISOString().split('T')[0];
        const dow = day.getDay();
        const isWeekend = dow === 0 || dow === 6;

        const dayNoise = rb(-0.1, 0.1);
        const occ = Math.max(0.05, Math.min(0.98, trait.occBase + dayNoise + (isWeekend ? -0.3 : 0)));
        const eff = Math.max(0.3, Math.min(0.98, trait.effBase + rb(-0.08, 0.08) + (isWeekend ? -0.15 : 0)));
        const vehicles = isWeekend ? Math.max(1, Math.floor(trait.vehicleBase * 0.4 + rb(0, 1))) : Math.floor(trait.vehicleBase + rb(-1, 2));
        const activeMin = rt(vehicles * rb(60, 120), 0);
        const idleMin = rt(vehicles * rb(10, 40), 0);
        const avgTime = vehicles > 0 ? Math.round(rb(45, 150)) : 0;
        const avgWait = Math.round(rb(5, 35));
        const workerPres = Math.max(0.5, Math.min(1, eff + rb(-0.05, 0.1)));
        const plannedOrders = vehicles + Math.floor(rb(0, 2));
        const completedOrders = Math.max(0, vehicles - Math.floor(rb(0, 1)));
        const noShows = isWeekend ? 0 : (sr() > 0.8 ? 1 : 0);
        const plannedH = rt(vehicles * rb(1.5, 2.5), 1);
        const actualH = rt(plannedH * rb(0.85, 1.2), 1);

        const hourly = [];
        for (let h = 8; h <= 19; h++) {
          const baseOcc = hourlyLoadBase(h, isWeekend);
          const postOcc = Math.max(0, Math.min(1, baseOcc + (occ - 0.5) * 0.3 + rb(-0.1, 0.1)));
          hourly.push({ hour: h, occupancy: rt(postOcc, 3), vehicles: postOcc > 0.5 ? 1 : (sr() > 0.5 ? 1 : 0) });
        }

        days.push({
          date: dateStr, occupancyRate: rt(occ, 3), efficiency: rt(eff, 3),
          vehicleCount: vehicles, avgTimePerVehicle: avgTime, avgWaitTime: avgWait,
          activeMinutes: activeMin, idleMinutes: idleMin, workerPresence: rt(workerPres, 3),
          plannedOrders, completedOrders, noShows, plannedHours: plannedH, actualHours: actualH, hourly,
        });
      }

      return {
        id: `post-${num}`,
        name: dbPost.displayName || dbPost.name || `Пост ${String(num).padStart(2, '0')}`,
        nameEn: dbPost.displayNameEn || `Post ${num}`,
        type: dbPost.type || 'light',
        worker: WORKERS_NAMES[pi % WORKERS_NAMES.length],
        master: MASTERS_NAMES[pi % MASTERS_NAMES.length],
        days,
      };
    });

    const daily = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(TODAY_BASE);
      day.setDate(day.getDate() - d);
      const dateStr = day.toISOString().split('T')[0];
      let totalVehicles = 0, totalNoShows = 0;
      posts.forEach(p => {
        const dd = p.days.find(dd => dd.date === dateStr);
        if (dd) { totalVehicles += dd.vehicleCount; totalNoShows += dd.noShows; }
      });
      daily.push({ date: dateStr, totalVehicles, totalNoShows });
    }

    res.json({ posts, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
