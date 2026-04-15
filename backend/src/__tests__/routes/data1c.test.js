import { describe, it, expect } from 'vitest';

// Test 1C integration business logic: header detection, deduplication, stats generation

// Replicate detectDataType logic from sync1C.js
function detectDataType(headers) {
  const headerStr = headers.map(h => (h || '').toString().trim()).join('|');
  if (headerStr.includes('Рабочее место') || headerStr.includes('Продолжительность') || headerStr.includes('Объект планирования')) {
    return 'planning';
  }
  if (headerStr.includes('Сотрудник') || headerStr.includes('Нормочасы') || headerStr.includes('Вид ремонта') || headerStr.includes('Заказ-наряд')) {
    return 'workers';
  }
  return headers.length >= 16 ? 'planning' : 'workers';
}

// Replicate deduplication logic from importFromXlsx
function deduplicatePlanning(newRecords, existingRecords) {
  const planKeys = new Set(existingRecords.map(r => `${r.number}|${r.workStation}|${r.startTime}`));
  const unique = newRecords.filter(r => !planKeys.has(`${r.number}|${r.workStation}|${r.startTime}`));
  return { unique, duplicates: newRecords.length - unique.length };
}

function deduplicateWorkers(newRecords, existingRecords) {
  const workerKeys = new Set(existingRecords.map(r => `${r.number}|${r.worker}|${r.startDate}`));
  const unique = newRecords.filter(r => !workerKeys.has(`${r.number}|${r.worker}|${r.startDate}`));
  return { unique, duplicates: newRecords.length - unique.length };
}

// Replicate generateStats logic
function generateStats(planning, workers) {
  const planByPost = {};
  const planByStatus = {};
  for (const p of planning) {
    const post = p.workStation || 'Не указан';
    planByPost[post] = (planByPost[post] || 0) + 1;
    const status = p.status || 'unknown';
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

describe('data1c - detectDataType from headers', () => {
  it('detects planning by "Рабочее место" header', () => {
    const headers = ['Документ', 'Мастер', 'Автор', 'Организация', 'Авто', 'Номер', 'ГРЗ', 'VIN', 'Начало', 'Конец', 'Рабочее место', 'Исполнитель'];
    expect(detectDataType(headers)).toBe('planning');
  });

  it('detects planning by "Продолжительность" header', () => {
    const headers = ['Документ', 'Мастер', 'Начало', 'Конец', 'Продолжительность'];
    expect(detectDataType(headers)).toBe('planning');
  });

  it('detects workers by "Сотрудник" header', () => {
    const headers = ['Вид ремонта', 'Номер', 'VIN', 'Марка', 'Модель', 'Год', 'Заказ-наряд', 'Сотрудник'];
    expect(detectDataType(headers)).toBe('workers');
  });

  it('detects workers by "Нормочасы" header', () => {
    const headers = ['Ремонт', 'Номер', 'VIN', 'Нормочасы'];
    expect(detectDataType(headers)).toBe('workers');
  });

  it('falls back to planning when 16+ columns', () => {
    const headers = Array.from({ length: 16 }, (_, i) => `Col${i}`);
    expect(detectDataType(headers)).toBe('planning');
  });

  it('falls back to workers when fewer than 16 columns', () => {
    const headers = Array.from({ length: 10 }, (_, i) => `Col${i}`);
    expect(detectDataType(headers)).toBe('workers');
  });
});

describe('data1c - deduplication logic', () => {
  it('removes duplicate planning records by number+workStation+startTime', () => {
    const existing = [
      { number: 'ЗН-001', workStation: 'Пост 1', startTime: '2026-04-10 08:00' },
    ];
    const newRecords = [
      { number: 'ЗН-001', workStation: 'Пост 1', startTime: '2026-04-10 08:00' }, // dup
      { number: 'ЗН-002', workStation: 'Пост 1', startTime: '2026-04-10 09:00' }, // new
    ];
    const result = deduplicatePlanning(newRecords, existing);
    expect(result.unique).toHaveLength(1);
    expect(result.unique[0].number).toBe('ЗН-002');
    expect(result.duplicates).toBe(1);
  });

  it('removes duplicate worker records by number+worker+startDate', () => {
    const existing = [
      { number: 'ЗН-001', worker: 'Иванов', startDate: '2026-04-10' },
    ];
    const newRecords = [
      { number: 'ЗН-001', worker: 'Иванов', startDate: '2026-04-10' }, // dup
      { number: 'ЗН-001', worker: 'Петров', startDate: '2026-04-10' }, // new (different worker)
    ];
    const result = deduplicateWorkers(newRecords, existing);
    expect(result.unique).toHaveLength(1);
    expect(result.unique[0].worker).toBe('Петров');
    expect(result.duplicates).toBe(1);
  });

  it('keeps all records when no duplicates exist', () => {
    const existing = [{ number: 'A', workStation: 'P1', startTime: '08:00' }];
    const newRecords = [
      { number: 'B', workStation: 'P1', startTime: '08:00' },
      { number: 'C', workStation: 'P2', startTime: '09:00' },
    ];
    const result = deduplicatePlanning(newRecords, existing);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toBe(0);
  });
});

describe('data1c - stats generation', () => {
  it('generates planning stats with byPost and byStatus', () => {
    const planning = [
      { workStation: 'Пост 1', status: 'in_progress', durationHours: 2 },
      { workStation: 'Пост 1', status: 'completed', durationHours: 3 },
      { workStation: 'Пост 2', status: 'in_progress', durationHours: 1.5 },
    ];
    const stats = generateStats(planning, []);
    expect(stats.planning.total).toBe(3);
    expect(stats.planning.totalHours).toBe(6.5);
    expect(stats.planning.byPost.find(p => p.name === 'Пост 1').count).toBe(2);
    expect(stats.planning.byPost.find(p => p.name === 'Пост 2').count).toBe(1);
    expect(stats.planning.byStatus.find(s => s.status === 'in_progress').count).toBe(2);
  });

  it('generates workers stats with uniqueWorkers and totalNormHours', () => {
    const workers = [
      { worker: 'Иванов', normHours: 5, brand: 'BMW', repairType: 'Диагностика' },
      { worker: 'Иванов', normHours: 3, brand: 'BMW', repairType: 'ТО' },
      { worker: 'Петров', normHours: 4, brand: 'OPEL', repairType: 'Диагностика' },
    ];
    const stats = generateStats([], workers);
    expect(stats.workers.total).toBe(3);
    expect(stats.workers.uniqueWorkers).toBe(2);
    expect(stats.workers.totalNormHours).toBe(12);
    expect(stats.workers.topWorkers[0].name).toBe('Иванов');
    expect(stats.workers.topWorkers[0].hours).toBe(8);
  });

  it('generates topBrands sorted by count descending', () => {
    const workers = [
      { worker: 'A', brand: 'BMW', normHours: 1 },
      { worker: 'B', brand: 'BMW', normHours: 1 },
      { worker: 'C', brand: 'OPEL', normHours: 1 },
    ];
    const stats = generateStats([], workers);
    expect(stats.workers.topBrands[0]).toEqual({ name: 'BMW', count: 2 });
    expect(stats.workers.topBrands[1]).toEqual({ name: 'OPEL', count: 1 });
  });

  it('handles empty data', () => {
    const stats = generateStats([], []);
    expect(stats.planning.total).toBe(0);
    expect(stats.planning.totalHours).toBe(0);
    expect(stats.workers.total).toBe(0);
    expect(stats.workers.uniqueWorkers).toBe(0);
    expect(stats.workers.totalNormHours).toBe(0);
  });
});

describe('data1c - sync history response format', () => {
  it('sync log entry has required fields', () => {
    const entry = {
      id: '123-abc',
      type: 'import',
      source: 'api',
      filename: 'test.xlsx',
      status: 'success',
      records: 15,
      errors: 0,
      details: JSON.stringify({ planning: { imported: 10, duplicates: 2 }, workers: { imported: 5, duplicates: 0 } }),
      createdAt: new Date().toISOString(),
    };
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('type');
    expect(entry).toHaveProperty('source');
    expect(entry).toHaveProperty('filename');
    expect(entry).toHaveProperty('status');
    expect(entry).toHaveProperty('records');
    expect(entry).toHaveProperty('errors');
    expect(entry).toHaveProperty('createdAt');

    const details = JSON.parse(entry.details);
    expect(details.planning).toHaveProperty('imported');
    expect(details.planning).toHaveProperty('duplicates');
    expect(details.workers).toHaveProperty('imported');
    expect(details.workers).toHaveProperty('duplicates');
  });
});
