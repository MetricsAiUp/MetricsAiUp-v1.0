/**
 * Парсит Excel-файлы из 1С и генерирует JSON для фронтенда
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const API_DIR = path.join(__dirname, '../../api');

function parseRepairPlanning() {
  const file = path.join(DATA_DIR, '1_Планирование_ремонта.xlsx');
  if (!fs.existsSync(file)) return [];

  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  return rows.map((r, i) => ({
    id: `plan-${i + 1}`,
    document: r['Документ'] || '',
    organization: r['Организация'] || '',
    vehicle: r['Автомобиль'] || null,
    number: r['Номер'] || '',
    plateNumber: r['Государственный номер'] || null,
    vin: r['VIN'] || null,
    startTime: r['Начало'] || null,
    endTime: r['Конец'] || null,
    workStation: r['Рабочее место'] || '',
    duration: r['Продолжительность'] || 0,
    durationHours: r['Продолжительность'] ? +(r['Продолжительность'] / 3600).toFixed(1) : 0,
    isActive: r['Не актуален'] !== 'Да',
    // Extract status from document name
    status: extractStatus(r['Документ'] || ''),
    docType: extractDocType(r['Документ'] || ''),
  }));
}

function parseWorkerOutput() {
  const file = path.join(DATA_DIR, '2_Выработка_исполнителей.xlsx');
  if (!fs.existsSync(file)) return [];

  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  return rows.map((r, i) => ({
    id: `work-${i + 1}`,
    workshop: r['Цех'] || '',
    repairType: r['Вид ремонта'] || '',
    number: r['Номер'] || '',
    date: r['Дата'] || '',
    vin: r['Автомобиль.VIN'] || null,
    brand: r['Автомобиль.Марка'] || '',
    model: r['Автомобиль.Модель автомобиля'] || '',
    year: r['Год выпуска автомобиля'] || null,
    workOrder: r['Заказ-наряд'] || '',
    worker: r['Сотрудник'] || '',
    startDate: r['Дата начала работ'] || null,
    endDate: r['Дата окончания'] || null,
    closeDate: r['Дата закрытия'] || null,
    orderStatus: r['Состояние заказ-наряда'] || '',
    master: r['Мастер'] || '',
    dispatcher: r['Диспетчер'] || '',
    consolidatedOrder: r['Сводный ремонтный заказ'] || '',
    basis: r['Основание'] || '',
    normHours: r['Количество нормочасов'] || 0,
  }));
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

function generateStats(planning, workers) {
  // Planning stats
  const planByPost = {};
  const planByStatus = {};
  for (const p of planning) {
    const post = p.workStation || 'Не указан';
    planByPost[post] = (planByPost[post] || 0) + 1;
    planByStatus[p.status] = (planByStatus[p.status] || 0) + 1;
  }

  // Worker stats
  const workerStats = {};
  const brandStats = {};
  const repairTypeStats = {};
  let totalNormHours = 0;
  for (const w of workers) {
    if (w.worker) workerStats[w.worker] = (workerStats[w.worker] || 0) + w.normHours;
    if (w.brand) brandStats[w.brand] = (brandStats[w.brand] || 0) + 1;
    if (w.repairType) repairTypeStats[w.repairType] = (repairTypeStats[w.repairType] || 0) + 1;
    totalNormHours += w.normHours || 0;
  }

  // Top workers sorted by hours
  const topWorkers = Object.entries(workerStats)
    .map(([name, hours]) => ({ name, hours: +hours.toFixed(1) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 15);

  // Brands sorted by count
  const topBrands = Object.entries(brandStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    planning: {
      total: planning.length,
      byPost: Object.entries(planByPost).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      byStatus: Object.entries(planByStatus).map(([status, count]) => ({ status, count })),
      totalHours: +(planning.reduce((s, p) => s + p.durationHours, 0)).toFixed(1),
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

function generate() {
  console.log('[Parse1C] Parsing Excel files...');
  const planning = parseRepairPlanning();
  const workers = parseWorkerOutput();
  const stats = generateStats(planning, workers);

  fs.mkdirSync(API_DIR, { recursive: true });
  fs.writeFileSync(path.join(API_DIR, '1c-planning.json'), JSON.stringify(planning));
  fs.writeFileSync(path.join(API_DIR, '1c-workers.json'), JSON.stringify(workers));
  fs.writeFileSync(path.join(API_DIR, '1c-stats.json'), JSON.stringify(stats));

  console.log(`[Parse1C] Planning: ${planning.length} rows, Workers: ${workers.length} rows`);
  console.log(`[Parse1C] Stats generated. Files written to ${API_DIR}`);
}

if (require.main === module) {
  generate();
}

module.exports = { generate, parseRepairPlanning, parseWorkerOutput };
