/**
 * sync1C.js — Service for 1C data synchronization
 * Import xlsx, export xlsx, sync history, file watcher
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../config/logger');
const registry = require('./_serviceRegistry');

const DATA_DIR = path.join(__dirname, '../../../data');
const IMPORT_DIR = path.join(DATA_DIR, '1c-import');
const PROCESSED_DIR = path.join(IMPORT_DIR, 'processed');

// Use Prisma if available, otherwise fallback to file-based sync logs
let prisma = null;
try {
  prisma = require('../config/database');
} catch (e) {
  logger.warn('Prisma not available, using file-based sync logs');
}

const SYNC_LOG_FILE = path.join(DATA_DIR, '1c-sync-log.json');

// =============================================
// Helpers
// =============================================

function generateId() {
  // Simple UUID without crypto module
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function readJsonFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeJsonFile(filename, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// =============================================
// Sync Log (file-based fallback)
// =============================================

function readSyncLogs() {
  if (!fs.existsSync(SYNC_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SYNC_LOG_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeSyncLog(entry) {
  const logs = readSyncLogs();
  logs.unshift(entry);
  // Keep last 200 entries
  if (logs.length > 200) logs.length = 200;
  fs.writeFileSync(SYNC_LOG_FILE, JSON.stringify(logs, null, 2));
}

async function createSyncLogEntry(data) {
  const entry = {
    id: generateId(),
    type: data.type || 'import',
    source: data.source || 'manual',
    filename: data.filename || null,
    status: data.status || 'pending',
    records: data.records || 0,
    errors: data.errors || 0,
    details: data.details || null,
    createdAt: new Date().toISOString(),
  };

  // Try Prisma first
  if (prisma) {
    try {
      return await prisma.syncLog.create({ data: entry });
    } catch (e) {
      // Prisma might not have the table yet, fallback
    }
  }

  // File-based fallback
  writeSyncLog(entry);
  return entry;
}

// =============================================
// Detect data type from headers
// =============================================

function detectDataType(headers) {
  const headerStr = headers.map(h => (h || '').toString().trim()).join('|');
  if (headerStr.includes('Рабочее место') || headerStr.includes('Продолжительность') || headerStr.includes('Объект планирования')) {
    return 'planning';
  }
  if (headerStr.includes('Сотрудник') || headerStr.includes('Нормочасы') || headerStr.includes('Вид ремонта') || headerStr.includes('Заказ-наряд')) {
    return 'workers';
  }
  // Default heuristic: if more than 14 columns, likely planning
  return headers.length >= 16 ? 'planning' : 'workers';
}

// =============================================
// Parse rows into records
// =============================================

function parsePlanningRows(rows) {
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const durSec = parseFloat(r[12]) || 0;
    results.push({
      id: `plan-${Date.now()}-${i}`,
      document: (r[0] || '').toString(),
      master: (r[1] || '').toString(),
      author: (r[2] || '').toString(),
      organization: (r[3] || '').toString(),
      vehicle: (r[4] || '').toString(),
      number: (r[5] || '').toString(),
      plateNumber: (r[6] || '').toString(),
      vin: (r[7] || '').toString(),
      startTime: (r[8] || '').toString(),
      endTime: (r[9] || '').toString(),
      workStation: (r[10] || '').toString(),
      executor: (r[11] || '').toString(),
      durationSec: durSec,
      durationHours: Math.round(durSec / 3600 * 10) / 10,
      notRelevant: (r[13] || '').toString(),
      planObject: (r[14] || '').toString(),
      objectView: (r[15] || '').toString().replace(/\r?\n/g, ' / '),
      // Derived fields for compatibility with parse1C.js
      isActive: (r[13] || '').toString() !== 'Да',
      status: extractStatus((r[0] || '').toString()),
      docType: extractDocType((r[0] || '').toString()),
    });
  }
  return results;
}

function parseWorkerRows(rows) {
  const results = [];
  // Skip header + optional subheader
  const startRow = rows.length > 2 && rows[1] && !rows[1][0] ? 2 : 1;
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const nh = parseFloat(r[14]) || 0;
    results.push({
      id: `work-${Date.now()}-${i}`,
      repairType: (r[0] || '').toString(),
      number: (r[1] || '').toString(),
      vin: (r[2] || '').toString(),
      brand: (r[3] || '').toString(),
      model: (r[4] || '').toString(),
      year: (r[5] || '').toString(),
      workOrder: (r[6] || '').toString(),
      worker: (r[7] || '').toString(),
      startDate: (r[8] || '').toString(),
      endDate: (r[9] || '').toString(),
      closeDate: (r[10] || '').toString(),
      orderStatus: (r[11] || '').toString(),
      master: (r[12] || '').toString(),
      dispatcher: (r[13] || '').toString(),
      normHours: nh,
    });
  }
  return results;
}

function extractStatus(doc) {
  if (doc.includes('Закрыт')) return 'closed';
  if (doc.includes('В работе')) return 'in_progress';
  if (doc.includes('Ожидание')) return 'waiting';
  if (doc.includes('проведен')) return 'completed';
  if (doc.includes('записан')) return 'scheduled';
  return 'unknown';
}

function extractDocType(doc) {
  if (doc.startsWith('Заказ-наряд')) return 'work_order';
  if (doc.startsWith('План ремонта')) return 'repair_plan';
  if (doc.startsWith('Заявка на ремонт')) return 'repair_request';
  return 'other';
}

// =============================================
// Generate stats (same logic as parse1C.js)
// =============================================

function generateStats(planning, workers) {
  const planByPost = {};
  const planByStatus = {};
  for (const p of planning) {
    const post = p.workStation || 'Не указан';
    planByPost[post] = (planByPost[post] || 0) + 1;
    const status = p.status || extractStatus(p.document || '');
    planByStatus[status] = (planByStatus[status] || 0) + 1;
  }

  const workerStats = {};
  const brandStats = {};
  const repairTypeStats = {};
  let totalNormHours = 0;
  for (const w of workers) {
    if (w.worker) workerStats[w.worker] = (workerStats[w.worker] || 0) + (w.normHours || 0);
    if (w.brand) brandStats[w.brand] = (brandStats[w.brand] || 0) + 1;
    if (w.repairType) repairTypeStats[w.repairType] = (repairTypeStats[w.repairType] || 0) + 1;
    totalNormHours += w.normHours || 0;
  }

  const topWorkers = Object.entries(workerStats)
    .map(([name, hours]) => ({ name, hours: +hours.toFixed(1) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 15);

  const topBrands = Object.entries(brandStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    planning: {
      total: planning.length,
      byPost: Object.entries(planByPost).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      byStatus: Object.entries(planByStatus).map(([status, count]) => ({ status, count })),
      totalHours: +(planning.reduce((s, p) => s + (p.durationHours || 0), 0)).toFixed(1),
    },
    workers: {
      total: workers.length,
      uniqueWorkers: Object.keys(workerStats).length,
      totalNormHours: +totalNormHours.toFixed(1),
      topWorkers,
      topBrands,
      byRepairType: Object.entries(repairTypeStats).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    },
  };
}

// =============================================
// MAIN: importFromXlsx
// =============================================

async function importFromXlsx(buffer, filename, source = 'manual') {
  let newPlanning = [];
  let newWorkers = [];
  let errorCount = 0;
  let errorDetails = [];

  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) continue;

      const headers = rows[0];
      const dataType = detectDataType(headers);

      if (dataType === 'planning') {
        newPlanning.push(...parsePlanningRows(rows));
      } else {
        newWorkers.push(...parseWorkerRows(rows));
      }
    }
  } catch (e) {
    errorCount++;
    errorDetails.push(`Parse error: ${e.message}`);
  }

  // Read existing data
  const existingPlanning = readJsonFile('1c-planning.json');
  const existingWorkers = readJsonFile('1c-workers.json');

  // Deduplicate planning: by (number + workStation + startTime)
  const planKeys = new Set(existingPlanning.map(r => `${r.number}|${r.workStation}|${r.startTime}`));
  const uniquePlanning = newPlanning.filter(r => !planKeys.has(`${r.number}|${r.workStation}|${r.startTime}`));
  const dupPlanning = newPlanning.length - uniquePlanning.length;

  // Deduplicate workers: by (number + worker + startDate)
  const workerKeys = new Set(existingWorkers.map(r => `${r.number}|${r.worker}|${r.startDate}`));
  const uniqueWorkers = newWorkers.filter(r => !workerKeys.has(`${r.number}|${r.worker}|${r.startDate}`));
  const dupWorkers = newWorkers.length - uniqueWorkers.length;

  // Merge and save
  const mergedPlanning = [...uniquePlanning, ...existingPlanning];
  const mergedWorkers = [...uniqueWorkers, ...existingWorkers];

  writeJsonFile('1c-planning.json', mergedPlanning);
  writeJsonFile('1c-workers.json', mergedWorkers);

  // Regenerate stats
  const stats = generateStats(mergedPlanning, mergedWorkers);
  writeJsonFile('1c-stats.json', stats);

  const totalImported = uniquePlanning.length + uniqueWorkers.length;
  const totalDuplicates = dupPlanning + dupWorkers;

  // Create sync log
  await createSyncLogEntry({
    type: 'import',
    source,
    filename,
    status: errorCount > 0 ? 'error' : 'success',
    records: totalImported,
    errors: errorCount,
    details: JSON.stringify({
      planning: { imported: uniquePlanning.length, duplicates: dupPlanning },
      workers: { imported: uniqueWorkers.length, duplicates: dupWorkers },
      errors: errorDetails,
    }),
  });

  return {
    imported: totalImported,
    duplicates: totalDuplicates,
    errors: errorCount,
    planning: { imported: uniquePlanning.length, duplicates: dupPlanning },
    workers: { imported: uniqueWorkers.length, duplicates: dupWorkers },
  };
}

// =============================================
// MAIN: exportToXlsx
// =============================================

async function exportToXlsx(filters = {}) {
  const workOrders = readJsonFile('work-orders.json');
  let data = workOrders;

  if (filters.status) {
    data = data.filter(wo => wo.status === filters.status);
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['Номер ЗН', 'Гос. номер', 'Время записи', 'Тип работ', 'Нормочасы', 'Факт. часы', 'Статус'],
    ...data.map(wo => [
      wo.orderNumber || wo.order_number || '',
      wo.plateNumber || wo.plate_number || '',
      wo.scheduledTime || wo.scheduled_time || '',
      wo.workType || wo.work_type || '',
      wo.normHours || wo.norm_hours || 0,
      wo.actualHours || wo.actual_hours || '',
      wo.status || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Create sync log
  await createSyncLogEntry({
    type: 'export',
    source: 'manual',
    filename: `work-orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    status: 'success',
    records: data.length,
    errors: 0,
  });

  return buffer;
}

// =============================================
// Sync History
// =============================================

async function getSyncHistory(limit = 50) {
  // Try Prisma first
  if (prisma) {
    try {
      return await prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (e) {
      // Fallback
    }
  }

  // File-based
  const logs = readSyncLogs();
  return logs.slice(0, limit);
}

// =============================================
// File Watcher (background job)
// =============================================

let watcherInterval = null;

function startFileWatcher(intervalMs = 5 * 60 * 1000) {
  // Create directories
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  registry.register('sync1C', { interval: intervalMs, dir: IMPORT_DIR });
  logger.info('File watcher started', { dir: IMPORT_DIR, intervalSec: intervalMs / 1000 });

  const checkFiles = async () => {
    try {
      registry.tick('sync1C');
      if (!fs.existsSync(IMPORT_DIR)) return;

      const files = fs.readdirSync(IMPORT_DIR).filter(f => /\.(xlsx|xls)$/i.test(f));
      if (!files.length) return;

      logger.info('Found files to process', { count: files.length });

      for (const file of files) {
        const filepath = path.join(IMPORT_DIR, file);
        try {
          const buffer = fs.readFileSync(filepath);
          const result = await importFromXlsx(buffer, file, 'auto');
          logger.info('Processed file', { file, imported: result.imported, duplicates: result.duplicates });

          // Move to processed
          const destPath = path.join(PROCESSED_DIR, `${Date.now()}_${file}`);
          fs.renameSync(filepath, destPath);
        } catch (e) {
          logger.error('Error processing file', { file, error: e.message });
          await createSyncLogEntry({
            type: 'import',
            source: 'auto',
            filename: file,
            status: 'error',
            records: 0,
            errors: 1,
            details: JSON.stringify({ error: e.message }),
          });
        }
      }
    } catch (e) {
      registry.error('sync1C', e);
      logger.error('File watcher error', { error: e.message });
    }
  };

  // Run immediately, then on interval
  checkFiles();
  watcherInterval = setInterval(checkFiles, intervalMs);
}

function stopFileWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    registry.unregister('sync1C');
    logger.info('File watcher stopped');
  }
}

module.exports = {
  importFromXlsx,
  exportToXlsx,
  getSyncHistory,
  startFileWatcher,
  stopFileWatcher,
  generateStats,
};
