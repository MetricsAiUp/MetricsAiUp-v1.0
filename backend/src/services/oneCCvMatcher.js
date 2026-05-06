// Матчинг записи 1С (OneCWorkOrderMerged) с CV-сессией (VehicleSession) и
// CV-постом (PostStay).
//
// Каскад:
//   1. exact VIN  (если поле появится в VehicleSession — сейчас не реализовано, конф 1.0)
//   2. exact plate (нормализованный uppercase, без пробелов/дефисов) — конф 0.9
//   3. fuzzy plate Levenshtein ≤ 2, только в окне ±N часов — конф 0.55
// Tie-breaker при ≥2 кандидатах — близость по времени к scheduledStart/orderDate.
//
// Окно матчинга задаётся в Imap1CConfig.matchWindowHours (default 24).

const prisma = require('../config/database');

// Levenshtein с ограничением (max 3 — ранний выход)
function levenshtein(a, b, max = 3) {
  if (a === b) return 0;
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > max) return max + 1; // уже за пределом — выход
  }
  return dp[n];
}

function normalizePlate(p) {
  if (!p) return null;
  return String(p).toUpperCase().replace(/[\s\-_.]/g, '');
}

async function getMatchWindowMs() {
  const cfg = await prisma.imap1CConfig.findUnique({ where: { id: 1 }, select: { matchWindowHours: true } });
  const hours = cfg?.matchWindowHours ?? 24;
  return hours * 60 * 60 * 1000;
}

// Выбор лучшего из нескольких кандидатов по близости времени
function chooseClosest(candidates, anchor, matchType, confidence) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { session: candidates[0], matchType, confidence, windowApplied: false };
  }
  const t = anchor instanceof Date ? anchor.getTime() : (anchor ? new Date(anchor).getTime() : null);
  if (t == null) {
    return { session: candidates[0], matchType, confidence: confidence * 0.9, windowApplied: false };
  }
  let best = null;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const ct = (c.entryTime || c.createdAt).getTime();
    const diff = Math.abs(ct - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return { session: best, matchType, confidence, windowApplied: true };
}

// Главная функция: ищет CV-матч для записи 1С (work-order-merged строка).
async function findMatch(orderRecord) {
  const { orderNumber, vin, plateNumber } = orderRecord;
  const anchor = orderRecord.scheduledStart || orderRecord.workStartedAt || orderRecord.orderDate;
  const windowMs = await getMatchWindowMs();
  const windowFrom = anchor ? new Date(anchor.getTime() - windowMs) : null;
  const windowTo = anchor ? new Date(anchor.getTime() + windowMs) : null;

  // 1. exact VIN — пока schema не имеет VehicleSession.vin, пропускаем
  // TODO: добавить VehicleSession.vin (миграция) когда CV начнёт его репортить

  // 2. exact plate
  if (plateNumber) {
    const np = normalizePlate(plateNumber);
    // Ищем все сессии (нормализуем plate в JS, т.к. SQLite не имеет regex_replace)
    const all = await prisma.vehicleSession.findMany({
      where: { plateNumber: { not: null } },
      select: { id: true, plateNumber: true, entryTime: true, createdAt: true },
    });
    const exact = all.filter((s) => normalizePlate(s.plateNumber) === np);
    if (exact.length >= 1) return chooseClosest(exact, anchor, 'exact_plate', 0.9);
  }

  // 3. fuzzy plate (только в окне)
  if (plateNumber && windowFrom && windowTo) {
    const candidates = await prisma.vehicleSession.findMany({
      where: {
        plateNumber: { not: null },
        entryTime: { gte: windowFrom, lte: windowTo },
      },
      select: { id: true, plateNumber: true, entryTime: true, createdAt: true },
    });
    const np = normalizePlate(plateNumber);
    const fuzzy = candidates.filter((s) => {
      const sp = normalizePlate(s.plateNumber);
      return sp && levenshtein(sp, np, 2) <= 2;
    });
    if (fuzzy.length >= 1) return chooseClosest(fuzzy, anchor, 'fuzzy_plate', 0.55);
  }

  return { session: null, matchType: 'none', confidence: 0, windowApplied: false };
}

// Найти PostStay в окне для уже выбранной сессии — для проверки wrong_post / no_show_in_1c
async function findPostStayForSession(sessionId, anchor, windowMs) {
  const stays = await prisma.postStay.findMany({
    where: { vehicleSessionId: sessionId },
    select: { id: true, postId: true, startTime: true, endTime: true, activeTime: true, idleTime: true, hasWorker: true },
  });
  if (stays.length === 0) return null;
  if (stays.length === 1 || !anchor) return stays[0];
  const t = anchor.getTime();
  const win = windowMs ?? 24 * 60 * 60 * 1000;
  let best = null;
  let bestDiff = Infinity;
  for (const s of stays) {
    const st = s.startTime.getTime();
    const diff = Math.abs(st - t);
    if (diff < bestDiff && diff <= win) {
      best = s;
      bestDiff = diff;
    }
  }
  return best || stays[0];
}

// Сохраняет/обновляет запись OneCCvMatch для кэша.
async function persistMatch(orderRecord, match) {
  const data = {
    orderNumber: orderRecord.orderNumber,
    vehicleSessionId: match.session?.id || null,
    matchType: match.matchType,
    confidence: match.confidence,
    windowApplied: match.windowApplied || false,
    matchedAt: new Date(),
  };
  // unique key: [orderNumber, vehicleSessionId]
  if (data.vehicleSessionId) {
    return prisma.oneCCvMatch.upsert({
      where: { orderNumber_vehicleSessionId: { orderNumber: data.orderNumber, vehicleSessionId: data.vehicleSessionId } },
      update: { matchType: data.matchType, confidence: data.confidence, windowApplied: data.windowApplied, matchedAt: data.matchedAt },
      create: data,
    });
  }
  // Без сессии — просто INSERT (но защитимся от дубликатов проверкой существования)
  const exists = await prisma.oneCCvMatch.findFirst({
    where: { orderNumber: data.orderNumber, vehicleSessionId: null, matchType: 'none' },
  });
  if (exists) return prisma.oneCCvMatch.update({ where: { id: exists.id }, data: { matchedAt: data.matchedAt } });
  return prisma.oneCCvMatch.create({ data });
}

module.exports = {
  findMatch,
  findPostStayForSession,
  persistMatch,
  normalizePlate,
  levenshtein,
};
