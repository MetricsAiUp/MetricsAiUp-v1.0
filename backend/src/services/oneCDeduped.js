// Централизованный helper доступа к «обработанным» данным 1С —
// дедуплицированный набор raw-таблиц + UI-фильтры, идентичный тому,
// что отдаётся фронту в /api/oneC/raw/:type.
//
// Правило (см. memory/feedback_1c_use_deduped_source.md):
//   ВСЕ сводки / матчинг / агрегаты поверх 1С обязаны идти через этот helper,
//   а не читать raw-таблицы напрямую.
//
// Дедуп-ключи (PARTITION BY) и UI-фильтры должны совпадать с
// backend/src/routes/oneC.js → RAW_META. При изменении одной стороны —
// синхронно править вторую.

const prisma = require('../config/database');

// snake_case → camelCase
function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'rn') continue;
    const ck = snakeToCamel(k);
    out[ck] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

const PLAN_DEDUP_COLS = [
  'document_text', 'organization',
  'vehicle_text', 'plate_number', 'vin',
  'number',
  'scheduled_start', 'scheduled_end',
  'duration_sec', 'is_outdated',
];

const REPAIR_DEDUP_COLS = [
  'vehicle_text', 'brand', 'model', 'plate_number_1', 'plate_number_2', 'vin',
  'order_number', 'state', 'repair_kind',
  'work_started_at', 'work_finished_at', 'closed_at',
  'basis', 'basis_start', 'basis_end',
  'master', 'dispatcher',
];

function partitionExpr(cols) {
  return cols.map((c) => `COALESCE(${c}, '')`).join(', ');
}

// Дедуп OneCPlanRow с UI-фильтром по document_type (только «План ремонта» /
// «Заявка на ремонт» — «Заказ-наряд» как documentText в матчинге не участвует).
async function getDedupedPlanRows() {
  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY ${partitionExpr(PLAN_DEDUP_COLS)}
        ORDER BY received_at DESC
      ) AS rn
      FROM one_c_plan_rows
      WHERE document_type IN ('План ремонта', 'Заявка на ремонт')
    ) WHERE rn = 1
  `;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map(camelizeRow);
}

// Дедуп OneCRepairSnapshot (UI-фильтров для этой таблицы нет).
async function getDedupedRepairRows() {
  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY ${partitionExpr(REPAIR_DEDUP_COLS)}
        ORDER BY received_at DESC
      ) AS rn
      FROM one_c_repair_snapshots
    ) WHERE rn = 1
  `;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map(camelizeRow);
}

module.exports = {
  getDedupedPlanRows,
  getDedupedRepairRows,
  PLAN_DEDUP_COLS,
  REPAIR_DEDUP_COLS,
};
