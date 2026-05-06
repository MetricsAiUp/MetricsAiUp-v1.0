// Детектор нестыковок: для одного orderNumber или массово.
//
// Вход: orderNumber → загружает текущую сводную (OneCWorkOrderMerged_current),
// текущие этапы (OneCStageMerged_current), матчит с CV (oneCCvMatcher),
// прогоняет 6 правил из discrepancyRules.
//
// Upsert в Discrepancy по @@unique([type, orderNumber, postId, vehicleSessionId]).
// Если новая запись — emit Socket.IO 'discrepancy:new'; критичные — Telegram (Phase 6).

const prisma = require('../config/database');
const logger = require('../config/logger');
const merger = require('./oneCMerger');
const matcher = require('./oneCCvMatcher');
const rules = require('./discrepancyRules');

// Лениво подгружаем notifier, чтобы избежать циклов require и держать детектор
// независимым от Socket.IO/Telegram (для unit-тестов).
let notifier = null;
function getNotifier() {
  if (notifier) return notifier;
  try { notifier = require('./discrepancyNotifier'); } catch { notifier = { notify: () => {} }; }
  return notifier;
}

function safeParseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  return new Date(d);
}

// Загружает current OneCWorkOrderMerged для конкретного orderNumber.
async function getCurrentOrder(orderNumber) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY received_at DESC) AS rn
      FROM one_c_work_order_merged
      WHERE order_number = ?
    ) WHERE rn = 1 LIMIT 1
  `, orderNumber);
  if (!rows.length) return null;
  const r = rows[0];
  // Преобразуем snake_case → camelCase + Date-объекты
  return {
    orderNumber: r.order_number,
    vin: r.vin,
    plateNumber: r.plate_number,
    state: r.state,
    normHours: r.norm_hours,
    executor: r.executor,
    master: r.master,
    orderDate: safeParseDate(r.order_date),
    scheduledStart: safeParseDate(r.scheduled_start),
    scheduledEnd: safeParseDate(r.scheduled_end),
    workStartedAt: safeParseDate(r.work_started_at),
    workFinishedAt: safeParseDate(r.work_finished_at),
    closedAt: safeParseDate(r.closed_at),
    inPlan: !!r.in_plan,
    inRepair: !!r.in_repair,
    inPerformed: !!r.in_performed,
  };
}

async function getCurrentStagesForOrder(orderNumber) {
  const rows = await merger.getStageCurrent({ orderNumber });
  return rows.map((r) => ({
    orderNumber: r.order_number,
    postRawName: r.post_raw_name,
    postId: r.post_id,
    scheduledStart: safeParseDate(r.scheduled_start),
    scheduledEnd: safeParseDate(r.scheduled_end),
    isOutdated: !!r.is_outdated,
    plateNumber: r.plate_number,
    vin: r.vin,
  }));
}

// Глобально подгружает все текущие стейджи (для no_show_in_1c, где нет orderNumber).
async function getAllCurrentStages() {
  const rows = await merger.getStageCurrent({});
  return rows.map((r) => ({
    orderNumber: r.order_number,
    postRawName: r.post_raw_name,
    postId: r.post_id,
    scheduledStart: safeParseDate(r.scheduled_start),
    scheduledEnd: safeParseDate(r.scheduled_end),
    isOutdated: !!r.is_outdated,
  }));
}

async function getPost(postId) {
  if (!postId) return null;
  return prisma.post.findUnique({ where: { id: postId }, select: { id: true, name: true, number: true, isTracked: true } });
}

// Сохранить или обновить Discrepancy. Возвращает { discrepancy, isNew }.
async function upsertDiscrepancy(draft) {
  const { type, orderNumber = null, postId = null, vehicleSessionId = null } = draft;

  const existing = await prisma.discrepancy.findFirst({
    where: { type, orderNumber, postId, vehicleSessionId },
  });

  const data = {
    type: draft.type,
    severity: draft.severity || 'warning',
    orderNumber,
    postId,
    vehicleSessionId,
    plateNumber: draft.plateNumber || null,
    vin: draft.vin || null,
    description: draft.description,
    descriptionEn: draft.descriptionEn || null,
    oneCValue: draft.oneCValue ? JSON.stringify(draft.oneCValue) : null,
    cvValue: draft.cvValue ? JSON.stringify(draft.cvValue) : null,
  };

  if (existing) {
    // Обновляем только если статус всё ещё open (resolved/dismissed не трогаем)
    if (existing.status !== 'open' && existing.status !== 'acknowledged') {
      return { discrepancy: existing, isNew: false, updated: false };
    }
    const updated = await prisma.discrepancy.update({
      where: { id: existing.id },
      data: {
        severity: data.severity,
        description: data.description,
        descriptionEn: data.descriptionEn,
        oneCValue: data.oneCValue,
        cvValue: data.cvValue,
        plateNumber: data.plateNumber,
        vin: data.vin,
      },
    });
    return { discrepancy: updated, isNew: false, updated: true };
  }

  const created = await prisma.discrepancy.create({ data });
  return { discrepancy: created, isNew: true, updated: false };
}

// Главная функция: для одного orderNumber.
async function detectForOrder(orderNumber) {
  const order = await getCurrentOrder(orderNumber);
  if (!order) return { detected: 0, new: 0 };

  const stages = await getCurrentStagesForOrder(orderNumber);

  // Матчинг
  const match = await matcher.findMatch(order);
  await matcher.persistMatch(order, match);

  // Если есть сессия — найдём ассоциированный PostStay
  const anchor = order.scheduledStart || order.workStartedAt || order.orderDate;
  const windowMs = 24 * 60 * 60 * 1000;
  const postStay = match.session
    ? await matcher.findPostStayForSession(match.session.id, anchor, windowMs)
    : null;
  const post = postStay ? await getPost(postStay.postId) : null;

  const ctx = {
    order,
    stages,
    match,
    postStay,
    post,
    anchor,
  };

  let detected = 0;
  let isNew = 0;
  for (const rule of rules.RULES) {
    let draft;
    try {
      draft = rule(ctx);
    } catch (err) {
      logger.error('discrepancy rule failed', { rule: rule.name, orderNumber, err: err.message });
      continue;
    }
    if (!draft) continue;
    detected++;
    draft.orderNumber = draft.orderNumber || order.orderNumber;
    draft.vehicleSessionId = draft.vehicleSessionId || match.session?.id || null;
    draft.plateNumber = draft.plateNumber || order.plateNumber;
    draft.vin = draft.vin || order.vin;

    const result = await upsertDiscrepancy(draft);
    if (result.isNew) {
      isNew++;
      // fire-and-forget уведомление; ошибки глотаются внутри notify
      try { getNotifier().notify(result.discrepancy); } catch (e) { logger.warn('notifier failed', { err: e.message }); }
    }
  }

  return { detected, new: isNew, orderNumber };
}

// Массовый прогон по всем orderNumber из current view + плюс осиротевшие PostStay
// без 1С-записи (для правила no_show_in_1c).
async function detectAll({ since } = {}) {
  // 1. Все orderNumbers из current view
  const orderRows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT order_number FROM one_c_work_order_merged
  `);
  const orderNumbers = orderRows.map((r) => r.order_number);

  let totalDetected = 0;
  let totalNew = 0;
  for (const on of orderNumbers) {
    const r = await detectForOrder(on);
    totalDetected += r.detected;
    totalNew += r.new;
  }

  // 2. Осиротевшие PostStay (no_show_in_1c) — за last 7 дней по умолчанию
  const sinceDate = since
    ? (typeof since === 'string' ? new Date(Date.now() - parseDuration(since)) : since)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stays = await prisma.postStay.findMany({
    where: { startTime: { gte: sinceDate } },
    select: { id: true, postId: true, vehicleSessionId: true, startTime: true, endTime: true, activeTime: true, idleTime: true, hasWorker: true },
  });
  const allStages = await getAllCurrentStages();

  for (const ps of stays) {
    const post = await getPost(ps.postId);
    if (!post || !post.isTracked) continue;
    const draft = rules.noShowIn1C({ postStay: ps, post, stages: allStages });
    if (!draft) continue;
    draft.vehicleSessionId = draft.vehicleSessionId || ps.vehicleSessionId;
    const result = await upsertDiscrepancy(draft);
    totalDetected++;
    if (result.isNew) {
      totalNew++;
      try { getNotifier().notify(result.discrepancy); } catch (e) { logger.warn('notifier failed', { err: e.message }); }
    }
  }

  logger.info('discrepancyDetector.detectAll done', { orders: orderNumbers.length, stays: stays.length, totalDetected, totalNew });
  return { orders: orderNumbers.length, totalDetected, totalNew };
}

function parseDuration(s) {
  // '24h' / '7d' / '30d'
  const m = String(s).match(/^(\d+)\s*([hdw])?$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2] || 'd';
  if (unit === 'h') return n * 60 * 60 * 1000;
  if (unit === 'w') return n * 7 * 24 * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

module.exports = {
  detectForOrder,
  detectAll,
  // exposed for tests
  _getCurrentOrder: getCurrentOrder,
  _upsertDiscrepancy: upsertDiscrepancy,
};
