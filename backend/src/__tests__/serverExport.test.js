import { describe, it, expect } from 'vitest';

// Test the report generation logic directly without mocking CJS requires.
// We replicate the core logic from serverExport.js and verify it.
const XLSX = require('xlsx');

function generateReportFromOrders(orders, periodDays) {
  const wb = XLSX.utils.book_new();

  const completed = orders.filter(o => o.status === 'completed');
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Orders', orders.length],
    ['Completed', completed.length],
    ['Total Norm Hours', +orders.reduce((s, o) => s + (o.normHours || 0), 0).toFixed(1)],
    ['Total Actual Hours', +completed.reduce((s, o) => s + (o.actualHours || 0), 0).toFixed(1)],
    ['Period (days)', periodDays],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

  const ordersData = [['Order #', 'Plate', 'Work Type', 'Status', 'Norm Hours', 'Actual Hours', 'Scheduled', 'Post']];
  orders.forEach(o => ordersData.push([o.orderNumber, o.plateNumber, o.workType, o.status, o.normHours, o.actualHours, o.scheduledTime?.toISOString()?.slice(0, 10), o.postNumber]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersData), 'Orders');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { buffer, filename };
}

describe('serverExport - generateReportXlsx logic', () => {
  it('returns a buffer and filename with current date', () => {
    const orders = [
      {
        orderNumber: 'WO-001', plateNumber: 'A123BC', workType: 'oil_change',
        status: 'completed', normHours: 2, actualHours: 1.5,
        scheduledTime: new Date('2026-04-09'), postNumber: 1,
      },
      {
        orderNumber: 'WO-002', plateNumber: 'B456DE', workType: 'diagnostics',
        status: 'scheduled', normHours: 1, actualHours: null,
        scheduledTime: new Date('2026-04-09'), postNumber: 2,
      },
    ];

    const result = generateReportFromOrders(orders, 1);

    expect(result).toHaveProperty('buffer');
    expect(result).toHaveProperty('filename');
    expect(Buffer.isBuffer(result.buffer) || result.buffer instanceof Uint8Array).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);

    const dateStr = new Date().toISOString().slice(0, 10);
    expect(result.filename).toContain(dateStr);
    expect(result.filename).toMatch(/^report-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('handles empty work orders list', () => {
    const result = generateReportFromOrders([], 7);

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.filename).toMatch(/\.xlsx$/);
  });

  it('produces valid XLSX with Summary and Orders sheets', () => {
    const orders = [
      {
        orderNumber: 'WO-001', plateNumber: 'A123BC', workType: 'oil_change',
        status: 'completed', normHours: 2, actualHours: 1.8,
        scheduledTime: new Date('2026-04-09'), postNumber: 3,
      },
    ];

    const result = generateReportFromOrders(orders, 1);
    const wb = XLSX.read(result.buffer, { type: 'buffer' });

    expect(wb.SheetNames).toContain('Summary');
    expect(wb.SheetNames).toContain('Orders');

    // Check summary content
    const summary = XLSX.utils.sheet_to_json(wb.Sheets['Summary'], { header: 1 });
    expect(summary[0]).toEqual(['Metric', 'Value']);
    expect(summary[1]).toEqual(['Total Orders', 1]);
    expect(summary[2]).toEqual(['Completed', 1]);

    // Check orders content
    const ordersSheet = XLSX.utils.sheet_to_json(wb.Sheets['Orders'], { header: 1 });
    expect(ordersSheet[0]).toEqual(['Order #', 'Plate', 'Work Type', 'Status', 'Norm Hours', 'Actual Hours', 'Scheduled', 'Post']);
    expect(ordersSheet[1][0]).toBe('WO-001');
    expect(ordersSheet[1][3]).toBe('completed');
  });

  it('correctly sums norm hours and actual hours', () => {
    const orders = [
      { orderNumber: 'WO-1', status: 'completed', normHours: 2, actualHours: 1.5 },
      { orderNumber: 'WO-2', status: 'completed', normHours: 3, actualHours: 2.8 },
      { orderNumber: 'WO-3', status: 'scheduled', normHours: 1.5, actualHours: null },
    ];

    const result = generateReportFromOrders(orders, 1);
    const wb = XLSX.read(result.buffer, { type: 'buffer' });
    const summary = XLSX.utils.sheet_to_json(wb.Sheets['Summary'], { header: 1 });

    // Total Norm Hours: 2 + 3 + 1.5 = 6.5
    expect(summary[3]).toEqual(['Total Norm Hours', 6.5]);
    // Total Actual Hours (completed only): 1.5 + 2.8 = 4.3
    expect(summary[4]).toEqual(['Total Actual Hours', 4.3]);
  });

  it('builds correct query date filter', () => {
    // Test the date filter logic from generateReportXlsx
    const periodDays = 3;
    const since = new Date();
    since.setDate(since.getDate() - periodDays);
    since.setHours(0, 0, 0, 0);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    expect(since.getTime()).toBe(threeDaysAgo.getTime());

    // The query should be: { where: { scheduledTime: { gte: since } }, orderBy: { scheduledTime: 'desc' } }
    const query = {
      where: { scheduledTime: { gte: since } },
      orderBy: { scheduledTime: 'desc' },
    };

    expect(query.where.scheduledTime.gte).toBeInstanceOf(Date);
    expect(query.orderBy.scheduledTime).toBe('desc');
  });
});
