import { describe, it, expect } from 'vitest';

// Test posts data analytics: status computation, period filtering, daily analytics, calendar

const POST_TYPES = {
  1: 'heavy', 2: 'heavy', 3: 'heavy', 4: 'heavy',
  5: 'light', 6: 'light', 7: 'light', 8: 'light',
  9: 'special', 10: 'special',
};

const POST_ZONES = {
  1: 'Ремонтная зона (посты 1-4)', 2: 'Ремонтная зона (посты 1-4)',
  5: 'Ремонтная зона (посты 5-9)', 6: 'Ремонтная зона (посты 5-9)',
  10: 'Ремонтная зона (посты 1-4, 10)',
};

// Replicate computePostStatus from postsData.js
function computePostStatus(wos) {
  const inProgress = wos.find(w => w.status === 'in_progress');
  if (inProgress) return 'active_work';
  const scheduled = wos.find(w => w.status === 'scheduled');
  if (scheduled) return 'occupied_no_work';
  return 'free';
}

// Replicate getPeriodRange from postsData.js
function getPeriodRange(period, from, to) {
  const now = new Date('2026-04-14T12:00:00Z');
  const todayStr = now.toISOString().split('T')[0];
  switch (period) {
    case 'yesterday': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const ds = d.toISOString().split('T')[0];
      return { dateFrom: ds, dateTo: ds };
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: todayStr };
    }
    case 'month': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: todayStr };
    }
    case 'custom':
      return { dateFrom: from || todayStr, dateTo: to || todayStr };
    default:
      return { dateFrom: todayStr, dateTo: todayStr };
  }
}

describe('postsData - computePostStatus', () => {
  it('returns active_work when any WO is in_progress', () => {
    const wos = [
      { status: 'scheduled' },
      { status: 'in_progress' },
    ];
    expect(computePostStatus(wos)).toBe('active_work');
  });

  it('returns occupied_no_work when scheduled but none in_progress', () => {
    const wos = [
      { status: 'scheduled' },
      { status: 'completed' },
    ];
    expect(computePostStatus(wos)).toBe('occupied_no_work');
  });

  it('returns free when no scheduled or in_progress', () => {
    const wos = [
      { status: 'completed' },
      { status: 'completed' },
    ];
    expect(computePostStatus(wos)).toBe('free');
  });

  it('returns free for empty work orders', () => {
    expect(computePostStatus([])).toBe('free');
  });
});

describe('postsData - period filtering', () => {
  it('today returns same date for from and to', () => {
    const range = getPeriodRange('today');
    expect(range.dateFrom).toBe('2026-04-14');
    expect(range.dateTo).toBe('2026-04-14');
  });

  it('yesterday returns previous day', () => {
    const range = getPeriodRange('yesterday');
    expect(range.dateFrom).toBe('2026-04-13');
    expect(range.dateTo).toBe('2026-04-13');
  });

  it('week returns 7-day range', () => {
    const range = getPeriodRange('week');
    expect(range.dateFrom).toBe('2026-04-08');
    expect(range.dateTo).toBe('2026-04-14');
  });

  it('month returns 30-day range', () => {
    const range = getPeriodRange('month');
    expect(range.dateFrom).toBe('2026-03-16');
    expect(range.dateTo).toBe('2026-04-14');
  });

  it('custom uses provided from/to', () => {
    const range = getPeriodRange('custom', '2026-03-01', '2026-03-31');
    expect(range.dateFrom).toBe('2026-03-01');
    expect(range.dateTo).toBe('2026-03-31');
  });

  it('defaults to today for unknown period', () => {
    const range = getPeriodRange('unknown_period');
    expect(range.dateFrom).toBe('2026-04-14');
    expect(range.dateTo).toBe('2026-04-14');
  });
});

describe('postsData - post types and zones', () => {
  it('posts 1-4 are heavy type', () => {
    for (let i = 1; i <= 4; i++) {
      expect(POST_TYPES[i]).toBe('heavy');
    }
  });

  it('posts 5-8 are light type', () => {
    for (let i = 5; i <= 8; i++) {
      expect(POST_TYPES[i]).toBe('light');
    }
  });

  it('posts 9-10 are special type', () => {
    expect(POST_TYPES[9]).toBe('special');
    expect(POST_TYPES[10]).toBe('special');
  });
});

describe('postsData - daily analytics computation', () => {
  it('computes occupancy as percentage of shift hours', () => {
    const activeHours = 6;
    const shiftHours = 12;
    const occupancy = Math.min(100, Math.round((activeHours / shiftHours) * 100 * 10) / 10);
    expect(occupancy).toBe(50);
  });

  it('caps occupancy at 100%', () => {
    const activeHours = 15;
    const shiftHours = 12;
    const occupancy = Math.min(100, Math.round((activeHours / shiftHours) * 100 * 10) / 10);
    expect(occupancy).toBe(100);
  });

  it('computes efficiency as actualHours / normHours * 100', () => {
    const totalNorm = 5;
    const totalActual = 4;
    const efficiency = totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0;
    expect(efficiency).toBe(80);
  });

  it('efficiency is 0 when no normHours', () => {
    const totalNorm = 0;
    const totalActual = 3;
    const efficiency = totalNorm > 0 ? Math.round((totalActual / totalNorm) * 100 * 10) / 10 : 0;
    expect(efficiency).toBe(0);
  });

  it('computes idle hours as maxH minus activeH', () => {
    const maxH = 12;
    const activeH = 7.5;
    const idleHours = Math.round(Math.max(0, maxH - activeH) * 10) / 10;
    expect(idleHours).toBe(4.5);
  });
});

describe('postsData - shift bounds', () => {
  it('default shift is 08:00-22:00', () => {
    const settings = { shiftStart: '08:00', shiftEnd: '22:00' };
    const dateStr = '2026-04-14';
    const shiftStart = new Date(`${dateStr}T${settings.shiftStart}:00`).getTime();
    const shiftEnd = new Date(`${dateStr}T${settings.shiftEnd}:00`).getTime();
    const maxH = (shiftEnd - shiftStart) / 3600000;
    expect(maxH).toBe(14);
  });

  it('weekSchedule overrides default shift bounds', () => {
    const settings = {
      shiftStart: '08:00', shiftEnd: '22:00',
      weekSchedule: { mon: { start: '09:00', end: '18:00', dayOff: false } },
    };
    const dayKey = 'mon';
    const ws = settings.weekSchedule;
    const startStr = ws[dayKey] && !ws[dayKey].dayOff ? ws[dayKey].start : settings.shiftStart;
    const endStr = ws[dayKey] && !ws[dayKey].dayOff ? ws[dayKey].end : settings.shiftEnd;
    expect(startStr).toBe('09:00');
    expect(endStr).toBe('18:00');
  });
});
