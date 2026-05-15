import { describe, it, expect, vi, beforeEach } from 'vitest';

const { writeFileMock } = vi.hoisted(() => ({ writeFileMock: vi.fn() }));

vi.mock('xlsx', async () => {
  const actual = await vi.importActual('xlsx');
  return {
    ...actual,
    writeFile: writeFileMock,
    default: { ...actual, writeFile: writeFileMock },
  };
});

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,fake',
    width: 800,
    height: 600,
  }),
}));
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    setFontSize: vi.fn(),
    text: vi.fn(),
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  })),
}));

import * as XLSX from 'xlsx';
import { exportToXlsx, downloadChartAsPng } from '../export.js';

function makePostSummary(overrides = {}) {
  return {
    name: 'Пост 1', nameEn: 'Post 1', type: 'heavy',
    avgOccupancy: 80, avgEfficiency: 70, totalVehicles: 10,
    avgVehiclesPerDay: 2, avgTimePerVehicle: 45, avgWaitTime: 5,
    totalActiveH: 4, totalIdleH: 1, avgWorkerPresence: 90,
    totalPlanned: 12, totalCompleted: 10, totalNoShows: 1,
    plannedH: 6, actualH: 4.5,
    days: [
      {
        date: '2026-04-14', occupancyRate: 0.8, efficiency: 0.7, vehicleCount: 2,
        avgTimePerVehicle: 45, avgWaitTime: 5, activeMinutes: 90, idleMinutes: 10,
        workerPresence: 0.9, plannedOrders: 3, completedOrders: 2, noShows: 0,
        plannedHours: 1.5, actualHours: 1.5,
      },
    ],
    ...overrides,
  };
}

describe('export — exportToXlsx()', () => {
  beforeEach(() => {
    writeFileMock.mockClear();
  });

  it('writes an xlsx with date-stamped filename', () => {
    const summary = [makePostSummary()];
    const filename = exportToXlsx(summary, summary, summary, summary[0].days, true);
    expect(filename).toMatch(/^analytics-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(writeFileMock).toHaveBeenCalledOnce();
  });

  it('produces 4 sheets (Summary/Posts/Daily/Details) in RU mode', () => {
    const summary = [makePostSummary()];
    exportToXlsx(summary, summary, summary, summary[0].days, true);
    const wb = writeFileMock.mock.calls[0][0];
    expect(wb.SheetNames).toContain('Сводка');
    expect(wb.SheetNames).toContain('Посты');
    expect(wb.SheetNames).toContain('По дням');
    expect(wb.SheetNames).toContain('Детали');
  });

  it('uses English sheet names when isRu=false', () => {
    const summary = [makePostSummary()];
    exportToXlsx(summary, summary, summary, summary[0].days, false);
    const wb = writeFileMock.mock.calls[0][0];
    expect(wb.SheetNames).toEqual(expect.arrayContaining(['Summary', 'Posts', 'Daily', 'Details']));
  });

  it('aggregates totals correctly in Summary sheet', () => {
    const summary = [
      makePostSummary({ avgOccupancy: 50, totalVehicles: 5 }),
      makePostSummary({ avgOccupancy: 100, totalVehicles: 15 }),
    ];
    exportToXlsx(summary, summary, summary, [], true);
    const wb = writeFileMock.mock.calls[0][0];
    const ws = wb.Sheets['Сводка'];
    const rows = XLSX.utils.sheet_to_json(ws);
    expect(rows[0]['Ср. занятость (%)']).toBeCloseTo(75, 0);
    expect(rows[0]['Всего авто']).toBe(20);
  });
});

describe('export — downloadChartAsPng()', () => {
  it('throws when element is null', async () => {
    await expect(downloadChartAsPng(null)).rejects.toThrow(/empty/);
  });

  it('creates an anchor and clicks it for a valid element', async () => {
    // Stub createElement('a').click()
    const clickSpy = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { click: clickSpy, href: '', download: '' };
      return realCreate(tag);
    });
    await downloadChartAsPng(document.createElement('div'), 'chart-test.png');
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
