// Сводник: raw-строки (OneCPlanRow / OneCRepairSnapshot / OneCWorkPerformed)
// → OneCWorkOrderMerged + OneCStageMerged.
//
// Стратегия:
//   - append-only (НЕ обновляем существующие записи)
//   - dedup по contentHash: если последняя запись по ключу имеет тот же hash —
//     ничего не вставляем
//
// OneCStageMerged (этапы): только из plan. Ключ (orderNumber, postRawName, scheduledStart).
// OneCWorkOrderMerged (заказ-наряд): из всех 3 типов. Ключ orderNumber.
//   При мерже приоритет полей: performed > repair > plan (более свежий источник).
//
// View *_current читается на лету в API через $queryRawUnsafe.

const prisma = require('../config/database');
const logger = require('../config/logger');
const { contentHash } = require('../utils/contentHash');

// helpers --------------------------------------------------------------------

function pick(...vals) {
  // Возвращает первое не-null/не-undefined значение
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

function pickBool(...vals) {
  for (const v of vals) {
    if (v === true || v === false) return v;
  }
  return false;
}

// merge stage rows -----------------------------------------------------------

async function mergeStagesFromPlan(planRows) {
  let inserted = 0;
  for (const row of planRows) {
    const hash = contentHash({
      orderNumber: row.number,
      postRawName: row.postRawName,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      durationSec: row.durationSec,
      isOutdated: row.isOutdated,
      postId: row.postId,
      vin: row.vin,
      plateNumber: row.plateNumber,
    });

    // Дедуп: ищем последнюю запись по ключу
    const last = await prisma.oneCStageMerged.findFirst({
      where: {
        orderNumber: row.number,
        postRawName: row.postRawName,
        scheduledStart: row.scheduledStart,
      },
      orderBy: { receivedAt: 'desc' },
    });

    if (last && last.contentHash === hash) continue;

    await prisma.oneCStageMerged.create({
      data: {
        orderNumber: row.number,
        postRawName: row.postRawName,
        postId: row.postId,
        scheduledStart: row.scheduledStart,
        scheduledEnd: row.scheduledEnd,
        durationSec: row.durationSec,
        isOutdated: row.isOutdated,
        vin: row.vin,
        plateNumber: row.plateNumber,
        contentHash: hash,
        receivedAt: row.receivedAt,
      },
    });
    inserted++;
  }
  return inserted;
}

// merge work-order rows ------------------------------------------------------

// Собирает агрегат по orderNumber из последних raw-данных всех трёх типов.
// receivedAt определяется как max(performed.receivedAt, repair.receivedAt, plan.receivedAt).
async function buildAggregateForOrder(orderNumber) {
  // Берём последнюю строку каждого типа по orderNumber.
  const performed = await prisma.oneCWorkPerformed.findFirst({
    where: { orderNumber },
    orderBy: { receivedAt: 'desc' },
  });
  const repair = await prisma.oneCRepairSnapshot.findFirst({
    where: { orderNumber },
    orderBy: { receivedAt: 'desc' },
  });
  // plan-таблица использует поле `number` вместо `orderNumber`
  const plan = await prisma.oneCPlanRow.findFirst({
    where: { number: orderNumber },
    orderBy: { receivedAt: 'desc' },
  });

  if (!performed && !repair && !plan) return null;

  // receivedAt — самый свежий из трёх
  const receivedAtCandidates = [performed?.receivedAt, repair?.receivedAt, plan?.receivedAt].filter(Boolean);
  const receivedAt = new Date(Math.max(...receivedAtCandidates.map((d) => d.getTime())));

  // Приоритет полей: performed > repair > plan (последний знает больше)
  const aggregate = {
    orderNumber,
    vin: pick(performed?.vin, repair?.vin, plan?.vin),
    brand: pick(performed?.brand, repair?.brand),
    model: pick(performed?.model, repair?.model),
    plateNumber: pick(performed?.plateNumber, repair?.plateNumber1, repair?.plateNumber2, plan?.plateNumber),
    yearMade: pick(performed?.yearMade, repair?.yearMade),
    mileage: pick(performed?.mileage, repair?.mileage),
    orderDate: pick(performed?.orderDate, repair?.orderDate),
    scheduledStart: pick(plan?.scheduledStart, repair?.basisStart),
    scheduledEnd: pick(plan?.scheduledEnd, repair?.basisEnd),
    workStartedAt: pick(performed?.workStartedAt, repair?.workStartedAt),
    workFinishedAt: pick(performed?.workFinishedAt, repair?.workFinishedAt),
    closedAt: pick(performed?.closedAt, repair?.closedAt),
    state: pick(performed?.state, repair?.state),
    documentType: pick(plan?.documentType),
    organization: pick(plan?.organization),
    repairKind: pick(performed?.repairKind, repair?.repairKind),
    basis: pick(repair?.basis),
    master: pick(performed?.master, repair?.master),
    dispatcher: pick(performed?.dispatcher, repair?.dispatcher),
    executor: pick(performed?.executor),
    causeDescription: pick(performed?.causeDescription),
    normHours: pick(performed?.normHours),
    inPlan: !!plan,
    inRepair: !!repair,
    inPerformed: !!performed,
    receivedAt,
  };

  return aggregate;
}

async function mergeWorkOrder(orderNumber) {
  const agg = await buildAggregateForOrder(orderNumber);
  if (!agg) return false;

  const hash = contentHash({
    state: agg.state,
    workStartedAt: agg.workStartedAt,
    workFinishedAt: agg.workFinishedAt,
    closedAt: agg.closedAt,
    scheduledStart: agg.scheduledStart,
    scheduledEnd: agg.scheduledEnd,
    plateNumber: agg.plateNumber,
    vin: agg.vin,
    normHours: agg.normHours,
    executor: agg.executor,
    master: agg.master,
    inPlan: agg.inPlan,
    inRepair: agg.inRepair,
    inPerformed: agg.inPerformed,
    mileage: agg.mileage,
  });

  const last = await prisma.oneCWorkOrderMerged.findFirst({
    where: { orderNumber },
    orderBy: { receivedAt: 'desc' },
  });
  if (last && last.contentHash === hash) return false;

  await prisma.oneCWorkOrderMerged.create({
    data: { ...agg, contentHash: hash },
  });
  return true;
}

// public ---------------------------------------------------------------------

async function mergeForImport(importId) {
  const imp = await prisma.oneCImport.findUnique({
    where: { id: importId },
    select: { detectedType: true },
  });
  if (!imp) return { merged: 0, stages: 0 };

  let stagesInserted = 0;
  let mergedInserted = 0;

  if (imp.detectedType === 'plan') {
    const planRows = await prisma.oneCPlanRow.findMany({ where: { importId } });
    stagesInserted = await mergeStagesFromPlan(planRows);
    const orderNumbers = [...new Set(planRows.map((r) => r.number))];
    for (const on of orderNumbers) {
      if (await mergeWorkOrder(on)) mergedInserted++;
    }
  } else if (imp.detectedType === 'repair') {
    const rows = await prisma.oneCRepairSnapshot.findMany({ where: { importId }, select: { orderNumber: true } });
    const orderNumbers = [...new Set(rows.map((r) => r.orderNumber))];
    for (const on of orderNumbers) {
      if (await mergeWorkOrder(on)) mergedInserted++;
    }
  } else if (imp.detectedType === 'performed') {
    const rows = await prisma.oneCWorkPerformed.findMany({ where: { importId }, select: { orderNumber: true } });
    const orderNumbers = [...new Set(rows.map((r) => r.orderNumber))];
    for (const on of orderNumbers) {
      if (await mergeWorkOrder(on)) mergedInserted++;
    }
  }

  logger.info('oneCMerger.mergeForImport done', { importId, type: imp.detectedType, stagesInserted, mergedInserted });
  return { merged: mergedInserted, stages: stagesInserted };
}

// Полный пересчёт сводных по всем raw-данным (на случай ручного триггера админа).
async function mergeAll() {
  // Все уникальные orderNumbers из 3 raw-таблиц
  const fromPerformed = await prisma.oneCWorkPerformed.findMany({ select: { orderNumber: true }, distinct: ['orderNumber'] });
  const fromRepair = await prisma.oneCRepairSnapshot.findMany({ select: { orderNumber: true }, distinct: ['orderNumber'] });
  const fromPlan = await prisma.oneCPlanRow.findMany({ select: { number: true }, distinct: ['number'] });
  const all = new Set([
    ...fromPerformed.map((r) => r.orderNumber),
    ...fromRepair.map((r) => r.orderNumber),
    ...fromPlan.map((r) => r.number),
  ]);

  let mergedInserted = 0;
  for (const on of all) {
    if (await mergeWorkOrder(on)) mergedInserted++;
  }

  // Стейджи из всех plan-строк
  const planRows = await prisma.oneCPlanRow.findMany();
  const stagesInserted = await mergeStagesFromPlan(planRows);

  logger.info('oneCMerger.mergeAll done', { orders: all.size, stagesInserted, mergedInserted });
  return { merged: mergedInserted, stages: stagesInserted, orders: all.size };
}

// Заменяет BigInt поля (ROW_NUMBER() в SQLite возвращает BigInt) на Number.
function sanitizeBigInts(rows) {
  return rows.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    delete out.rn;
    return out;
  });
}

// View-like helpers — последние записи по ключу.
// Используется в API: GET /api/oneC/current.
async function getWorkOrderCurrent({ take, skip } = {}) {
  // Используем raw SQL с window function (SQLite 3.25+).
  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY received_at DESC) AS rn
      FROM one_c_work_order_merged
    ) WHERE rn = 1
    ORDER BY received_at DESC
    ${take ? `LIMIT ${parseInt(take, 10)}` : ''}
    ${skip ? `OFFSET ${parseInt(skip, 10)}` : ''}
  `;
  const rows = await prisma.$queryRawUnsafe(sql);
  return sanitizeBigInts(rows);
}

async function getStageCurrent({ orderNumber, take, skip } = {}) {
  const where = orderNumber ? `WHERE order_number = ?` : '';
  const params = orderNumber ? [orderNumber] : [];
  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY order_number, post_raw_name, scheduled_start ORDER BY received_at DESC) AS rn
      FROM one_c_stage_merged
      ${where}
    ) WHERE rn = 1
    ORDER BY scheduled_start ASC
    ${take ? `LIMIT ${parseInt(take, 10)}` : ''}
    ${skip ? `OFFSET ${parseInt(skip, 10)}` : ''}
  `;
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return sanitizeBigInts(rows);
}

module.exports = {
  mergeForImport,
  mergeAll,
  mergeWorkOrder,
  buildAggregateForOrder,
  getWorkOrderCurrent,
  getStageCurrent,
};
