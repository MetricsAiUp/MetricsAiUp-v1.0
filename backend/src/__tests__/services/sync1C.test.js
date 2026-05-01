import { describe, it, expect } from 'vitest';

// Тесты для чистых helper-функций sync1C.js. Не импортируем сам сервис,
// чтобы не запускать file watcher и не трогать prisma — реплицируем функции.

// ── Реплики из sync1C.js ──

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

function parsePlanningRows(rows) {
  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const durSec = parseFloat(r[12]) || 0;
    results.push({
      id: `plan-test-${i}`, // в тестах фиксируем id, в проде — Date.now()
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
      isActive: (r[13] || '').toString() !== 'Да',
      status: extractStatus((r[0] || '').toString()),
      docType: extractDocType((r[0] || '').toString()),
    });
  }
  return results;
}

function parseWorkerRows(rows) {
  const results = [];
  const startRow = rows.length > 2 && rows[1] && !rows[1][0] ? 2 : 1;
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const nh = parseFloat(r[14]) || 0;
    results.push({
      id: `work-test-${i}`,
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

// Дедупликация (как в importFromXlsx)
function dedupPlanning(existing, fresh) {
  const keys = new Set(existing.map(r => `${r.number}|${r.workStation}|${r.startTime}`));
  return fresh.filter(r => !keys.has(`${r.number}|${r.workStation}|${r.startTime}`));
}
function dedupWorkers(existing, fresh) {
  const keys = new Set(existing.map(r => `${r.number}|${r.worker}|${r.startDate}`));
  return fresh.filter(r => !keys.has(`${r.number}|${r.worker}|${r.startDate}`));
}

describe('sync1C - detectDataType', () => {
  it('detects planning by "Рабочее место" header', () => {
    expect(detectDataType(['Документ', 'Рабочее место', 'Старт'])).toBe('planning');
  });

  it('detects planning by "Продолжительность"', () => {
    expect(detectDataType(['A', 'Продолжительность', 'B'])).toBe('planning');
  });

  it('detects planning by "Объект планирования"', () => {
    expect(detectDataType(['A', 'Объект планирования'])).toBe('planning');
  });

  it('detects workers by "Сотрудник"', () => {
    expect(detectDataType(['Вид ремонта', 'Сотрудник', 'Норма'])).toBe('workers');
  });

  it('detects workers by "Нормочасы"', () => {
    expect(detectDataType(['A', 'Нормочасы'])).toBe('workers');
  });

  it('detects workers by "Заказ-наряд"', () => {
    expect(detectDataType(['Заказ-наряд', 'A'])).toBe('workers');
  });

  it('detects workers by "Вид ремонта"', () => {
    expect(detectDataType(['Вид ремонта', 'A'])).toBe('workers');
  });

  it('falls back to planning for >=16 columns when no markers found', () => {
    const headers = Array.from({ length: 16 }, (_, i) => `Col${i}`);
    expect(detectDataType(headers)).toBe('planning');
  });

  it('falls back to workers for short header without markers', () => {
    expect(detectDataType(['A', 'B', 'C'])).toBe('workers');
  });

  it('handles empty/null cells in headers', () => {
    expect(detectDataType([null, undefined, 'Сотрудник'])).toBe('workers');
  });
});

describe('sync1C - extractStatus', () => {
  it('returns closed for "Закрыт" (case-sensitive, capital З)', () => {
    expect(extractStatus('Заказ-наряд Закрыт №123')).toBe('closed');
    // lowercase не матчится — это поведение источника, фиксируем
    expect(extractStatus('закрыт')).toBe('unknown');
  });
  it('returns in_progress for "В работе"', () => {
    expect(extractStatus('Заказ-наряд (В работе)')).toBe('in_progress');
  });
  it('returns waiting for "Ожидание"', () => {
    expect(extractStatus('Ожидание клиента')).toBe('waiting');
  });
  it('returns completed for "проведен"', () => {
    expect(extractStatus('Документ проведен')).toBe('completed');
  });
  it('returns scheduled for "записан"', () => {
    expect(extractStatus('Документ записан')).toBe('scheduled');
  });
  it('returns unknown for unrecognized strings', () => {
    expect(extractStatus('что-то неизвестное')).toBe('unknown');
    expect(extractStatus('')).toBe('unknown');
  });
  it('checks substrings in priority order — "Закрыт" перед "В работе"', () => {
    // Если оба варианта присутствуют в строке, первая проверка побеждает
    expect(extractStatus('документ Закрыт после В работе')).toBe('closed');
  });
});

describe('sync1C - extractDocType', () => {
  it('returns work_order for "Заказ-наряд..."', () => {
    expect(extractDocType('Заказ-наряд №555 закрыт')).toBe('work_order');
  });
  it('returns repair_plan for "План ремонта..."', () => {
    expect(extractDocType('План ремонта 12')).toBe('repair_plan');
  });
  it('returns repair_request for "Заявка на ремонт..."', () => {
    expect(extractDocType('Заявка на ремонт авто')).toBe('repair_request');
  });
  it('returns other for unmatched prefixes', () => {
    expect(extractDocType('Что-то ещё')).toBe('other');
    expect(extractDocType('')).toBe('other');
  });
  it('requires startsWith — substring match doesn\'t count', () => {
    expect(extractDocType('XX Заказ-наряд')).toBe('other');
  });
});

describe('sync1C - parsePlanningRows', () => {
  const headers = Array.from({ length: 16 }, (_, i) => `Col${i}`);

  it('skips header row and empty rows', () => {
    const rows = [
      headers,
      null,
      [null, 'M', 'A', 'O', 'V', '111', 'AA1234'],
    ];
    const out = parsePlanningRows(rows);
    expect(out).toHaveLength(0); // r[0] empty → skipped
  });

  it('parses one planning row with all fields', () => {
    const r = ['Заказ-наряд №1', 'Master', 'Author', 'Org', 'Vehicle', '101', 'AA1234',
      'VIN12345', '2026-05-01 08:00', '2026-05-01 10:00', 'Пост 01', 'Worker', '7200',
      'Нет', 'Object', 'View'];
    const out = parsePlanningRows([headers, r]);
    expect(out).toHaveLength(1);
    expect(out[0].number).toBe('101');
    expect(out[0].plateNumber).toBe('AA1234');
    expect(out[0].workStation).toBe('Пост 01');
    expect(out[0].durationSec).toBe(7200);
    expect(out[0].durationHours).toBe(2.0);
    expect(out[0].docType).toBe('work_order');
    expect(out[0].isActive).toBe(true); // notRelevant !== 'Да'
  });

  it('marks notRelevant=="Да" rows as inactive', () => {
    const r = ['Doc', '', '', '', '', '', '', '', '', '', '', '', '0', 'Да', '', ''];
    const out = parsePlanningRows([headers, r]);
    expect(out[0].isActive).toBe(false);
  });

  it('replaces newlines in objectView with " / "', () => {
    const r = ['Doc', ...Array(14).fill(''), 'line1\nline2\r\nline3'];
    const out = parsePlanningRows([headers, r]);
    expect(out[0].objectView).toBe('line1 / line2 / line3');
  });

  it('handles non-numeric duration as 0', () => {
    const r = ['Doc', '', '', '', '', '', '', '', '', '', '', '', 'не число', '', '', ''];
    const out = parsePlanningRows([headers, r]);
    expect(out[0].durationSec).toBe(0);
    expect(out[0].durationHours).toBe(0);
  });
});

describe('sync1C - parseWorkerRows', () => {
  const headers = ['Тип', 'Номер', 'VIN', 'Бренд', 'Модель', 'Год', 'ЗН', 'Сотрудник',
    'Нач', 'Кон', 'Закр', 'Статус', 'Мастер', 'Дисп', 'НормоЧ'];

  it('parses single worker row', () => {
    const r = ['ТО', '101', 'VIN1', 'Toyota', 'Camry', '2020', 'ЗН-1',
      'Иванов', '2026-05-01', '2026-05-02', '', 'closed', 'Master', 'Disp', '4.5'];
    const out = parseWorkerRows([headers, r]);
    expect(out).toHaveLength(1);
    expect(out[0].brand).toBe('Toyota');
    expect(out[0].normHours).toBe(4.5);
    expect(out[0].worker).toBe('Иванов');
  });

  it('skips subheader row when rows[1][0] is empty', () => {
    const r1 = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    const r2 = ['ТО', '101', '', '', '', '', '', 'Иванов', '', '', '', '', '', '', '2'];
    const out = parseWorkerRows([headers, r1, r2]);
    expect(out).toHaveLength(1);
    expect(out[0].number).toBe('101');
  });

  it('handles non-numeric normHours as 0', () => {
    const r = ['ТО', '1', '', '', '', '', '', '', '', '', '', '', '', '', 'foo'];
    const out = parseWorkerRows([headers, r]);
    expect(out[0].normHours).toBe(0);
  });

  it('skips null rows', () => {
    const r = ['ТО', '1', '', '', '', '', '', '', '', '', '', '', '', '', '1'];
    const out = parseWorkerRows([headers, null, r]);
    expect(out).toHaveLength(1);
  });
});

describe('sync1C - generateStats', () => {
  it('aggregates planning byPost and byStatus', () => {
    const planning = [
      { workStation: 'Пост 01', status: 'closed', durationHours: 2 },
      { workStation: 'Пост 01', status: 'in_progress', durationHours: 1 },
      { workStation: 'Пост 02', status: 'closed', durationHours: 3 },
    ];
    const stats = generateStats(planning, []);
    expect(stats.planning.total).toBe(3);
    expect(stats.planning.totalHours).toBe(6);
    const post01 = stats.planning.byPost.find(p => p.name === 'Пост 01');
    expect(post01.count).toBe(2);
    const closed = stats.planning.byStatus.find(s => s.status === 'closed');
    expect(closed.count).toBe(2);
  });

  it('uses "Не указан" for empty workStation', () => {
    const planning = [{ workStation: '', status: 'closed' }];
    const stats = generateStats(planning, []);
    expect(stats.planning.byPost[0].name).toBe('Не указан');
  });

  it('falls back to extractStatus when status missing', () => {
    const planning = [{ workStation: 'P1', document: 'Документ Закрыт' }];
    const stats = generateStats(planning, []);
    expect(stats.planning.byStatus[0].status).toBe('closed');
  });

  it('aggregates worker hours, brands, repair types', () => {
    const workers = [
      { worker: 'Иванов', brand: 'Toyota', repairType: 'ТО', normHours: 2 },
      { worker: 'Иванов', brand: 'Toyota', repairType: 'ТО', normHours: 3 },
      { worker: 'Петров', brand: 'BMW', repairType: 'Кузов', normHours: 5 },
    ];
    const stats = generateStats([], workers);
    expect(stats.workers.total).toBe(3);
    expect(stats.workers.uniqueWorkers).toBe(2);
    expect(stats.workers.totalNormHours).toBe(10);
    expect(stats.workers.topWorkers[0]).toEqual({ name: 'Иванов', hours: 5 });
    expect(stats.workers.topBrands[0]).toEqual({ name: 'Toyota', count: 2 });
  });

  it('caps topWorkers at 15', () => {
    const workers = Array.from({ length: 20 }, (_, i) => ({
      worker: `W${i}`, normHours: i + 1,
    }));
    const stats = generateStats([], workers);
    expect(stats.workers.topWorkers).toHaveLength(15);
    // Самый большой час — W19=20
    expect(stats.workers.topWorkers[0].name).toBe('W19');
  });

  it('handles empty input', () => {
    const stats = generateStats([], []);
    expect(stats.planning.total).toBe(0);
    expect(stats.planning.byPost).toEqual([]);
    expect(stats.workers.totalNormHours).toBe(0);
  });
});

describe('sync1C - dedup keys', () => {
  it('planning dedup by number+workStation+startTime', () => {
    const existing = [{ number: '1', workStation: 'P01', startTime: '08:00' }];
    const fresh = [
      { number: '1', workStation: 'P01', startTime: '08:00' }, // dup
      { number: '1', workStation: 'P01', startTime: '09:00' }, // new
      { number: '2', workStation: 'P01', startTime: '08:00' }, // new
    ];
    const out = dedupPlanning(existing, fresh);
    expect(out).toHaveLength(2);
    expect(out.map(r => r.startTime + '|' + r.number).sort()).toEqual(['08:00|2', '09:00|1']);
  });

  it('workers dedup by number+worker+startDate', () => {
    const existing = [{ number: '1', worker: 'Ivan', startDate: '2026-05-01' }];
    const fresh = [
      { number: '1', worker: 'Ivan', startDate: '2026-05-01' }, // dup
      { number: '1', worker: 'Ivan', startDate: '2026-05-02' }, // new
      { number: '1', worker: 'Petr', startDate: '2026-05-01' }, // new
    ];
    const out = dedupWorkers(existing, fresh);
    expect(out).toHaveLength(2);
  });

  it('empty existing — все fresh пропускаются', () => {
    const out = dedupPlanning([], [
      { number: '1', workStation: 'P', startTime: 'A' },
      { number: '2', workStation: 'P', startTime: 'B' },
    ]);
    expect(out).toHaveLength(2);
  });
});
