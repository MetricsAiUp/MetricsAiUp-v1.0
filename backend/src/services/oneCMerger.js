// Сводник: raw-строки → OneCWorkOrderMerged + OneCStageMerged.
// Append-only с дедупом по contentHash.
//
// Phase 2 — заглушка (вызывается из importer, но реальная логика идёт в Phase 3).
// TODO Phase 3: полная реализация merge-стратегии (по orderNumber + по этапам)
// + view *_current через raw SQL.

const logger = require('../config/logger');

async function mergeForImport(importId) {
  // Заглушка: пока ничего не делает. Полная реализация — Phase 3.
  logger.info('oneCMerger.mergeForImport: stub (Phase 3 pending)', { importId });
  return { merged: 0, stages: 0 };
}

async function mergeAll() {
  logger.info('oneCMerger.mergeAll: stub (Phase 3 pending)');
  return { merged: 0, stages: 0 };
}

module.exports = { mergeForImport, mergeAll };
