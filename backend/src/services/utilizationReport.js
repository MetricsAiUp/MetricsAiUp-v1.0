// Сервис расчёта сводного отчёта /api/reports/utilization.
//
// ИСТОЧНИК ДАННЫХ:
//   • Занятость (busy)   — MonitoringSnapshot (как у /api/posts-analytics и /api/monitoring/post-history)
//                          таймлайн снапшотов CV по zoneName, занятость = интервалы со status !== 'free',
//                          с защитой от провалов данных GAP_THRESHOLD_MS.
//   • Рабочий фонд       — окно работы СТО из Location.workStart/workEnd × workDays
//                          (одинаково для постов и зон, не зависит от Shift-записей).
//   • Загрузка %         — busy / shiftFund × 100  (capped at 100% для табличной читабельности)
//   • Финблок (только посты) — Location.hourlyRate × фонд/занятость/простой.
//
// Связь Post ↔ MonitoringSnapshot.zoneName: regex /Пост\s+0?(\d+)/i → совпадение с post.number.
// Связь Zone ↔ MonitoringSnapshot.zoneName: regex /Свободная\s+зона\s+0?(\d+)/i → Zone "Зона 0N"
//   (плюс fallback по подстроке для специфичных имён).

const prisma = require('../config/database');

// Порог разрыва: если CV молчит дольше — состояние «cur» не подтверждено.
// Совпадает с postsData.js (там GAP_THRESHOLD_MS = 5 мин).
const GAP_THRESHOLD_MS = 5 * 60 * 1000;

// ── helpers: TZ-aware ─────────────────────────────────────────────────────

function dateStrInTz(d, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function isoDowInTz(d, tz) {
  const wk = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(d).toLowerCase();
  return { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }[wk];
}

function localToUtc(dateStr, timeStr, tz) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const naiveUtc = Date.UTC(Y, M - 1, D, h, m, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(naiveUtc)).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const wallInTz = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  const offsetMs = wallInTz - naiveUtc;
  return new Date(naiveUtc - offsetMs);
}

function listDays(from, to, tz) {
  const out = [];
  let cur = new Date(from);
  let curDateStr = dateStrInTz(cur, tz);
  const endDateStr = dateStrInTz(to, tz);
  while (curDateStr <= endDateStr) {
    out.push(curDateStr);
    cur = new Date(localToUtc(curDateStr, '00:00', tz).getTime() + 26 * 3600000);
    curDateStr = dateStrInTz(cur, tz);
    if (out.length > 366) break;
  }
  return out;
}

// ── helpers: интервалы ────────────────────────────────────────────────────

function overlapMin(a1, a2, b1, b2) {
  const s = Math.max(a1, b1);
  const e = Math.min(a2, b2);
  return e > s ? Math.round((e - s) / 60000) : 0;
}

function sumOverlapMin(s, e, windows) {
  let sum = 0;
  for (const w of windows) sum += overlapMin(s, e, w.start, w.end);
  return sum;
}

function clipWindows(windows, from, to) {
  const out = [];
  for (const w of windows) {
    const s = Math.max(w.start, from);
    const e = Math.min(w.end, to);
    if (e > s) out.push({ start: s, end: e, dateStr: w.dateStr });
  }
  return out;
}

function mergeWindows(windows) {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

// ── окна работы СТО (общий фонд) ──────────────────────────────────────────

function buildWorkWindows(location, fromMs, toMs) {
  const tz = location.timezone || 'Europe/Moscow';
  const workDays = new Set(
    String(location.workDays || '1,2,3,4,5,6').split(',').map(s => Number(s.trim())).filter(Boolean)
  );
  const out = [];
  const days = listDays(new Date(fromMs), new Date(toMs), tz);
  for (const dateStr of days) {
    const dummyMidday = localToUtc(dateStr, '12:00', tz);
    const dow = isoDowInTz(dummyMidday, tz);
    if (!workDays.has(dow)) continue;
    const startMs = localToUtc(dateStr, location.workStart || '08:00', tz).getTime();
    let endMs = localToUtc(dateStr, location.workEnd || '20:00', tz).getTime();
    if (endMs <= startMs) endMs += 86400000;
    out.push({ start: startMs, end: endMs, dateStr });
  }
  return mergeWindows(clipWindows(out, fromMs, toMs));
}

// ── matching: post.number ↔ zoneName, zone ↔ zoneName ─────────────────────

/** Извлекает номер поста из zoneName CV. "Пост 01 — легковое" → 1, "Пост 4" → 4. */
function extractPostNumber(zoneName) {
  if (!zoneName) return null;
  const m = String(zoneName).match(/Пост\s+0?(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Извлекает номер свободной зоны: "Свободная зона 03 — ожидание" → 3. */
function extractFreeZoneNumber(zoneName) {
  if (!zoneName) return null;
  const m = String(zoneName).match(/Свободная\s+зона\s+0?(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Извлекает номер из "Зона 01" → 1. */
function extractDbZoneNumber(name) {
  if (!name) return null;
  const m = String(name).match(/Зона\s+0?(\d+)/i);
  return m ? Number(m[1]) : null;
}

// ── расчёт занятости из таймлайна снапшотов ───────────────────────────────

/**
 * Считает занятость (busyMin) за пересечение таймлайна снапшотов c work-windows.
 * @param {Array<{timestamp: Date, status: string}>} snapshots — сортируется внутри
 * @param {Array<{start, end}>} windows — окна работы (UTC ms)
 * @param {number} toMs — конец периода (UTC ms), нужен как «сейчас» для последнего сегмента
 * @returns {number} минуты занятости
 */
function busyMinFromSnapshots(snapshots, windows, toMs) {
  if (!snapshots || snapshots.length === 0 || windows.length === 0) return 0;
  const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const nowMs = Math.min(Date.now(), toMs);
  let busyMin = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const start = new Date(cur.timestamp).getTime();
    const rawEnd = next ? new Date(next.timestamp).getTime() : nowMs;
    const end = Math.min(rawEnd, start + GAP_THRESHOLD_MS);
    if (cur.status === 'free') continue;
    busyMin += sumOverlapMin(start, end, windows);
  }
  return busyMin;
}

// ── основная функция ──────────────────────────────────────────────────────

const DEFAULT_LOCATION = {
  timezone: 'Europe/Moscow',
  workStart: '08:00',
  workEnd: '20:00',
  workDays: '1,2,3,4,5,6',
  hourlyRate: null,
  currency: 'RUB',
  errorMarginPct: null,
  errorMarginNote: null,
};

async function getLocationConfig(locationId) {
  let loc = null;
  if (locationId) {
    loc = await prisma.location.findUnique({ where: { id: locationId } });
  }
  if (!loc) {
    loc = await prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }
  if (!loc) return { ...DEFAULT_LOCATION };
  return {
    ...DEFAULT_LOCATION,
    ...loc,
    hourlyRate: loc.hourlyRate != null ? Number(loc.hourlyRate) : null,
  };
}

async function computeUtilization({ from, to, entity = 'posts', locationId, compare = false }) {
  const location = await getLocationConfig(locationId);
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const core = await computeCore({ fromMs, toMs, entity, location });

  let compareBlock = null;
  if (compare) {
    const len = toMs - fromMs;
    const cFromMs = fromMs - len;
    const cToMs = fromMs;
    compareBlock = await computeCore({ fromMs: cFromMs, toMs: cToMs, entity, location });
    compareBlock.period = { from: new Date(cFromMs).toISOString(), to: new Date(cToMs).toISOString() };
    for (const e of compareBlock.byEntity) delete e.byDay;
  }

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      days: listDays(from, to, location.timezone).length,
    },
    errorMargin: {
      pct: location.errorMarginPct,
      note: location.errorMarginNote,
    },
    hourlyRate: location.hourlyRate,
    currency: location.currency,
    workWindow: {
      start: location.workStart,
      end: location.workEnd,
      days: location.workDays,
      timezone: location.timezone,
    },
    entity,
    totals: core.totals,
    byEntity: core.byEntity,
    compare: compareBlock ? {
      period: compareBlock.period,
      totals: compareBlock.totals,
      byEntity: compareBlock.byEntity,
    } : null,
  };
}

async function computeCore({ fromMs, toMs, entity, location }) {
  if (entity === 'zones') return await computeZones({ fromMs, toMs, location });
  return await computePosts({ fromMs, toMs, location });
}

// ── общая загрузка снапшотов за период ───────────────────────────────────

/**
 * Грузим снапшоты + «якорный» снапшот ПЕРЕД периодом, чтобы корректно покрыть
 * левый край (если последний переход status случился раньше from, состояние
 * перед периодом известно).
 */
async function loadSnapshotsByZoneNames(zoneNames, fromMs, toMs) {
  if (zoneNames.length === 0) return new Map();
  // Расширим окно влево на 1 час — этого хватит для якоря.
  const anchorMs = fromMs - 3600000;
  const rows = await prisma.monitoringSnapshot.findMany({
    where: {
      zoneName: { in: zoneNames },
      timestamp: { gte: new Date(anchorMs), lte: new Date(toMs) },
    },
    select: { zoneName: true, timestamp: true, status: true },
    orderBy: { timestamp: 'asc' },
  });
  const byZone = new Map(zoneNames.map(z => [z, []]));
  for (const r of rows) {
    byZone.get(r.zoneName)?.push(r);
  }
  return byZone;
}

/** distinct zoneNames из MonitoringSnapshot (на всю историю — их мало, дешево). */
async function getAllSnapshotZoneNames() {
  const rows = await prisma.monitoringSnapshot.findMany({
    distinct: ['zoneName'],
    select: { zoneName: true },
  });
  return rows.map(r => r.zoneName);
}

// ── посты ────────────────────────────────────────────────────────────────

async function computePosts({ fromMs, toMs, location }) {
  const posts = await prisma.post.findMany({
    where: { isActive: true, deleted: false, isTracked: true },
    orderBy: [{ number: 'asc' }, { name: 'asc' }],
  });
  if (posts.length === 0) {
    return { totals: emptyTotals(true), byEntity: [] };
  }

  // Связываем post.number ↔ один или несколько zoneName в мониторинге.
  const allZones = await getAllSnapshotZoneNames();
  const zoneByPostNumber = new Map(); // postNumber → [zoneName, ...]
  for (const zn of allZones) {
    const n = extractPostNumber(zn);
    if (n == null) continue;
    if (!zoneByPostNumber.has(n)) zoneByPostNumber.set(n, []);
    zoneByPostNumber.get(n).push(zn);
  }

  // Окно работы СТО — единое для всех постов.
  const workWindows = buildWorkWindows(location, fromMs, toMs);
  const tz = location.timezone;

  // Один SQL на все zoneNames.
  const allMatchedZones = [...new Set([].concat(...zoneByPostNumber.values()))];
  const snapshotsByZone = await loadSnapshotsByZoneNames(allMatchedZones, fromMs, toMs);

  const days = listDays(new Date(fromMs), new Date(toMs), tz);

  const byEntity = posts.map(p => {
    const matchedZones = zoneByPostNumber.get(p.number) || [];
    // Сливаем снапшоты со всех совпавших зон (на случай двух имён одного поста).
    const allSnaps = [];
    for (const zn of matchedZones) {
      allSnaps.push(...(snapshotsByZone.get(zn) || []));
    }
    allSnaps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const shiftFundMin = workWindows.reduce((s, w) => s + Math.round((w.end - w.start) / 60000), 0);
    const busyMin = busyMinFromSnapshots(allSnaps, workWindows, toMs);

    const byDay = days.map(dateStr => {
      const dayStart = localToUtc(dateStr, '00:00', tz).getTime();
      const dayEnd = dayStart + 86400000;
      const dayWindows = clipWindows(workWindows, dayStart, dayEnd);
      const dayShiftFundMin = dayWindows.reduce((s, w) => s + Math.round((w.end - w.start) / 60000), 0);
      const dayBusyMin = busyMinFromSnapshots(allSnaps, dayWindows, dayEnd);
      return {
        date: dateStr,
        shiftFund: round1(dayShiftFundMin / 60),
        busy: round1(Math.min(dayBusyMin, dayShiftFundMin) / 60),
        loadPct: dayShiftFundMin > 0 ? Math.min(100, Math.round((dayBusyMin / dayShiftFundMin) * 100)) : null,
      };
    });

    const shiftFundH = shiftFundMin / 60;
    const cappedBusyMin = Math.min(busyMin, shiftFundMin);
    const busyH = cappedBusyMin / 60;
    const idleH = Math.max(0, shiftFundH - busyH);
    const loadPct = shiftFundMin > 0 ? Math.min(100, (cappedBusyMin / shiftFundMin) * 100) : 0;
    const rate = location.hourlyRate || 0;

    return {
      id: p.id,
      number: p.number,
      name: p.displayName || p.name,
      nameEn: p.displayNameEn || p.name,
      type: p.type,
      shiftFund: round1(shiftFundH),
      busy: round1(busyH),
      idle: round1(idleH),
      loadPct: Math.round(loadPct * 10) / 10,
      earned: round0(busyH * rate),
      lost: round0(idleH * rate),
      byDay,
    };
  });

  const totalShiftFund = byEntity.reduce((s, e) => s + e.shiftFund, 0);
  const totalBusy = byEntity.reduce((s, e) => s + e.busy, 0);
  const totalIdle = Math.max(0, totalShiftFund - totalBusy);
  const totalLoadPct = totalShiftFund > 0 ? (totalBusy / totalShiftFund) * 100 : 0;
  const rate = location.hourlyRate || 0;

  return {
    totals: {
      shiftFund: round1(totalShiftFund),
      busy: round1(totalBusy),
      idle: round1(totalIdle),
      loadPct: Math.round(totalLoadPct * 10) / 10,
      potential: round0(totalShiftFund * rate),
      earned: round0(totalBusy * rate),
      lost: round0(totalIdle * rate),
    },
    byEntity,
  };
}

// ── зоны ────────────────────────────────────────────────────────────────

async function computeZones({ fromMs, toMs, location }) {
  const zones = await prisma.zone.findMany({
    where: { isActive: true, deleted: false },
    orderBy: [{ name: 'asc' }],
  });
  if (zones.length === 0) {
    return { totals: emptyTotals(false), byEntity: [] };
  }

  // Связь Zone.name (например, "Зона 03") ↔ MonitoringSnapshot.zoneName ("Свободная зона 03 — …").
  const allZones = await getAllSnapshotZoneNames();
  const zoneByDbNumber = new Map(); // number → [snapshotZoneName, ...]
  for (const zn of allZones) {
    const n = extractFreeZoneNumber(zn);
    if (n == null) continue;
    if (!zoneByDbNumber.has(n)) zoneByDbNumber.set(n, []);
    zoneByDbNumber.get(n).push(zn);
  }

  const workWindows = buildWorkWindows(location, fromMs, toMs);
  const tz = location.timezone;

  const allMatchedZones = [...new Set([].concat(...zoneByDbNumber.values()))];
  const snapshotsByZone = await loadSnapshotsByZoneNames(allMatchedZones, fromMs, toMs);

  const days = listDays(new Date(fromMs), new Date(toMs), tz);
  const shiftFundMin = workWindows.reduce((s, w) => s + Math.round((w.end - w.start) / 60000), 0);

  const byEntity = zones.map(z => {
    const dbNum = extractDbZoneNumber(z.displayName || z.name);
    const matchedZones = dbNum != null ? (zoneByDbNumber.get(dbNum) || []) : [];
    const allSnaps = [];
    for (const zn of matchedZones) {
      allSnaps.push(...(snapshotsByZone.get(zn) || []));
    }
    allSnaps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const busyMin = busyMinFromSnapshots(allSnaps, workWindows, toMs);

    const byDay = days.map(dateStr => {
      const dayStart = localToUtc(dateStr, '00:00', tz).getTime();
      const dayEnd = dayStart + 86400000;
      const dayWindows = clipWindows(workWindows, dayStart, dayEnd);
      const dayShiftFundMin = dayWindows.reduce((s, w) => s + Math.round((w.end - w.start) / 60000), 0);
      const dayBusyMin = busyMinFromSnapshots(allSnaps, dayWindows, dayEnd);
      return {
        date: dateStr,
        shiftFund: round1(dayShiftFundMin / 60),
        busy: round1(Math.min(dayBusyMin, dayShiftFundMin) / 60),
        loadPct: dayShiftFundMin > 0 ? Math.min(100, Math.round((dayBusyMin / dayShiftFundMin) * 100)) : null,
      };
    });

    const shiftFundH = shiftFundMin / 60;
    const cappedBusyMin = Math.min(busyMin, shiftFundMin);
    const busyH = cappedBusyMin / 60;
    const idleH = Math.max(0, shiftFundH - busyH);
    const loadPct = shiftFundMin > 0 ? Math.min(100, (cappedBusyMin / shiftFundMin) * 100) : 0;

    return {
      id: z.id,
      name: z.displayName || z.name,
      nameEn: z.displayNameEn || z.name,
      type: z.type,
      shiftFund: round1(shiftFundH),
      busy: round1(busyH),
      idle: round1(idleH),
      loadPct: Math.round(loadPct * 10) / 10,
      byDay,
    };
  });

  const totalShiftFund = byEntity.reduce((s, e) => s + e.shiftFund, 0);
  const totalBusy = byEntity.reduce((s, e) => s + e.busy, 0);
  const totalIdle = Math.max(0, totalShiftFund - totalBusy);
  const totalLoadPct = totalShiftFund > 0 ? (totalBusy / totalShiftFund) * 100 : 0;

  return {
    totals: {
      shiftFund: round1(totalShiftFund),
      busy: round1(totalBusy),
      idle: round1(totalIdle),
      loadPct: Math.round(totalLoadPct * 10) / 10,
    },
    byEntity,
  };
}

// ── утилиты ──────────────────────────────────────────────────────────────

function round1(x) { return Math.round(x * 10) / 10; }
function round0(x) { return Math.round(x); }

function emptyTotals(isPosts) {
  return {
    shiftFund: 0, busy: 0, idle: 0, loadPct: 0,
    ...(isPosts ? { potential: 0, earned: 0, lost: 0 } : {}),
  };
}

module.exports = {
  computeUtilization,
  _internal: {
    overlapMin,
    sumOverlapMin,
    dateStrInTz,
    isoDowInTz,
    localToUtc,
    listDays,
    mergeWindows,
    clipWindows,
    buildWorkWindows,
    extractPostNumber,
    extractFreeZoneNumber,
    extractDbZoneNumber,
    busyMinFromSnapshots,
  },
};
