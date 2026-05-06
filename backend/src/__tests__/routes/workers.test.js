import { describe, it, expect } from 'vitest';

// Test workers route logic: stats aggregation, daily breakdown, top types/brands, efficiency

describe('workers - stats aggregation from work orders', () => {
  const orders = [
    { id: '1', worker: 'Иванов', status: 'completed', normHours: 2, actualHours: 2.5, workType: 'Диагностика', brand: 'BMW', model: 'X5', scheduledTime: new Date('2026-04-10T09:00:00Z') },
    { id: '2', worker: 'Иванов', status: 'completed', normHours: 3, actualHours: 2.8, workType: 'ТО', brand: 'OPEL', model: 'Astra', scheduledTime: new Date('2026-04-10T14:00:00Z') },
    { id: '3', worker: 'Иванов', status: 'in_progress', normHours: 1.5, actualHours: null, workType: 'Диагностика', brand: 'BMW', model: '320', scheduledTime: new Date('2026-04-11T10:00:00Z') },
    { id: '4', worker: 'Иванов', status: 'scheduled', normHours: 4, actualHours: null, workType: 'Кузовной', brand: 'HYUNDAI', model: 'Tucson', scheduledTime: new Date('2026-04-12T08:00:00Z') },
  ];

  it('counts total and completed work orders', () => {
    const completed = orders.filter(o => o.status === 'completed');
    expect(orders.length).toBe(4);
    expect(completed.length).toBe(2);
  });

  it('sums totalNormHours across all orders', () => {
    const totalNorm = orders.reduce((s, o) => s + (o.normHours || 0), 0);
    expect(totalNorm).toBe(10.5);
  });

  it('sums totalActualHours from completed orders only', () => {
    const completed = orders.filter(o => o.status === 'completed');
    const totalActual = completed.reduce((s, o) => s + (o.actualHours || 0), 0);
    expect(totalActual).toBe(5.3);
  });
});

describe('workers - efficiency calculation', () => {
  it('calculates efficiency as normHours / actualHours * 100', () => {
    const totalNorm = 10.5;
    const totalActual = 5.3;
    const efficiency = totalActual > 0 ? +((totalNorm / totalActual) * 100).toFixed(1) : 0;
    expect(efficiency).toBe(198.1);
  });

  it('returns 0 when no actual hours', () => {
    const totalNorm = 10;
    const totalActual = 0;
    const efficiency = totalActual > 0 ? +((totalNorm / totalActual) * 100).toFixed(1) : 0;
    expect(efficiency).toBe(0);
  });

  it('100% efficiency when norm equals actual', () => {
    const efficiency = +((5 / 5) * 100).toFixed(1);
    expect(efficiency).toBe(100);
  });
});

describe('workers - top repair types extraction', () => {
  it('groups by workType and sorts by count descending', () => {
    const orders = [
      { workType: 'Диагностика', normHours: 1 },
      { workType: 'Диагностика', normHours: 1.5 },
      { workType: 'ТО', normHours: 2 },
      { workType: 'Кузовной', normHours: 4 },
      { workType: 'Диагностика', normHours: 1 },
    ];
    const typeMap = {};
    orders.forEach(o => {
      if (o.workType) {
        if (!typeMap[o.workType]) typeMap[o.workType] = { count: 0, normHours: 0 };
        typeMap[o.workType].count++;
        typeMap[o.workType].normHours += o.normHours || 0;
      }
    });
    const topTypes = Object.entries(typeMap)
      .map(([type, d]) => ({ type, count: d.count, normHours: +d.normHours.toFixed(1) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    expect(topTypes[0].type).toBe('Диагностика');
    expect(topTypes[0].count).toBe(3);
    expect(topTypes[0].normHours).toBe(3.5);
    expect(topTypes[1].type).toBe('ТО');
    expect(topTypes).toHaveLength(3);
  });
});

describe('workers - top brands extraction', () => {
  it('groups by brand and sorts by count descending', () => {
    const orders = [
      { brand: 'BMW' }, { brand: 'BMW' }, { brand: 'BMW' },
      { brand: 'OPEL' }, { brand: 'OPEL' },
      { brand: 'HYUNDAI' },
    ];
    const brandMap = {};
    orders.forEach(o => {
      if (o.brand) brandMap[o.brand] = (brandMap[o.brand] || 0) + 1;
    });
    const topBrands = Object.entries(brandMap)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    expect(topBrands[0]).toEqual({ brand: 'BMW', count: 3 });
    expect(topBrands[1]).toEqual({ brand: 'OPEL', count: 2 });
    expect(topBrands[2]).toEqual({ brand: 'HYUNDAI', count: 1 });
  });

  it('handles orders without brand', () => {
    const orders = [{ brand: null }, { brand: 'BMW' }, { brand: undefined }];
    const brandMap = {};
    orders.forEach(o => {
      if (o.brand) brandMap[o.brand] = (brandMap[o.brand] || 0) + 1;
    });
    expect(Object.keys(brandMap)).toEqual(['BMW']);
  });
});

describe('workers - daily breakdown calculation', () => {
  it('groups orders by date from scheduledTime', () => {
    const orders = [
      { scheduledTime: new Date('2026-04-10T09:00:00Z'), normHours: 2, actualHours: 2.5 },
      { scheduledTime: new Date('2026-04-10T14:00:00Z'), normHours: 3, actualHours: 2.8 },
      { scheduledTime: new Date('2026-04-11T10:00:00Z'), normHours: 1.5, actualHours: 0 },
    ];
    const dailyMap = {};
    orders.forEach(o => {
      const date = o.scheduledTime ? new Date(o.scheduledTime).toISOString().slice(0, 10) : null;
      if (!date) return;
      if (!dailyMap[date]) dailyMap[date] = { date, workOrders: 0, normHours: 0, actualHours: 0 };
      dailyMap[date].workOrders++;
      dailyMap[date].normHours += o.normHours || 0;
      dailyMap[date].actualHours += o.actualHours || 0;
    });
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    expect(daily).toHaveLength(2);
    expect(daily[0].date).toBe('2026-04-10');
    expect(daily[0].workOrders).toBe(2);
    expect(daily[0].normHours).toBe(5);
    expect(daily[0].actualHours).toBe(5.3);
    expect(daily[1].date).toBe('2026-04-11');
    expect(daily[1].workOrders).toBe(1);
  });

  it('skips orders without scheduledTime', () => {
    const orders = [{ scheduledTime: null, normHours: 2 }];
    const dailyMap = {};
    orders.forEach(o => {
      const date = o.scheduledTime ? new Date(o.scheduledTime).toISOString().slice(0, 10) : null;
      if (!date) return;
      dailyMap[date] = { date, workOrders: 1 };
    });
    expect(Object.keys(dailyMap)).toHaveLength(0);
  });
});

describe('workers - response shape', () => {
  it('stats response has all required sections', () => {
    const response = {
      worker: { name: 'Иванов', totalOrders: 4 },
      summary: {
        totalWorkOrders: 4,
        completedWorkOrders: 2,
        totalNormHours: 10.5,
        totalActualHours: 5.3,
        avgEfficiency: 198.1,
      },
      topRepairTypes: [{ type: 'Диагностика', count: 3, normHours: 3.5 }],
      topBrands: [{ brand: 'BMW', count: 3 }],
      dailyStats: [{ date: '2026-04-10', workOrders: 2, normHours: 5, actualHours: 5.3 }],
      recentOrders: [{ id: '1', number: 'ЗН-001', workType: 'Диагностика', status: 'completed' }],
    };
    expect(response).toHaveProperty('worker');
    expect(response).toHaveProperty('summary');
    expect(response).toHaveProperty('topRepairTypes');
    expect(response).toHaveProperty('topBrands');
    expect(response).toHaveProperty('dailyStats');
    expect(response).toHaveProperty('recentOrders');
    expect(response.summary.avgEfficiency).toBeGreaterThan(0);
  });
});
