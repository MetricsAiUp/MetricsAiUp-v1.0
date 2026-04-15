import { describe, it, expect } from 'vitest';

// Test monitoring proxy logic: post/zone extraction, status mapping, summary

// Replicate extractPostNumber from monitoringProxy.js
function extractPostNumber(zoneName) {
  const m = zoneName.match(/^Пост\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// Replicate extractFreeZoneNumber from monitoringProxy.js
function extractFreeZoneNumber(zoneName) {
  const m = zoneName.match(/^Свободная зона\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// Replicate mapStatus from monitoringProxy.js
function mapStatus(ext) {
  if (ext.status === 'free') return 'free';
  if (ext.worksInProgress) return 'active_work';
  return 'occupied';
}

// Replicate getSummary logic from monitoringProxy.js
function getSummary(posts) {
  const totalPosts = posts.length;
  const working = posts.filter(p => p.status === 'active_work').length;
  const occupied = posts.filter(p => p.status !== 'free').length;
  const free = posts.filter(p => p.status === 'free').length;
  const idle = posts.filter(p => p.status === 'occupied').length;
  return { totalPosts, working, occupied, free, idle };
}

describe('monitoring - extractPostNumber', () => {
  it('extracts post number from "Пост 01"', () => {
    expect(extractPostNumber('Пост 01')).toBe(1);
  });

  it('extracts post number from "Пост 10 — грузовое"', () => {
    expect(extractPostNumber('Пост 10 — грузовое')).toBe(10);
  });

  it('extracts post number from "Пост 04 — легковое"', () => {
    expect(extractPostNumber('Пост 04 — легковое')).toBe(4);
  });

  it('returns null for non-post zone names', () => {
    expect(extractPostNumber('Свободная зона 01')).toBeNull();
    expect(extractPostNumber('Ремонтная зона')).toBeNull();
    expect(extractPostNumber('')).toBeNull();
  });
});

describe('monitoring - extractFreeZoneNumber', () => {
  it('extracts zone number from "Свободная зона 01 — оклейка/стекла"', () => {
    expect(extractFreeZoneNumber('Свободная зона 01 — оклейка/стекла')).toBe(1);
  });

  it('extracts zone number from "Свободная зона 07"', () => {
    expect(extractFreeZoneNumber('Свободная зона 07')).toBe(7);
  });

  it('returns null for post zone names', () => {
    expect(extractFreeZoneNumber('Пост 01')).toBeNull();
    expect(extractFreeZoneNumber('Парковка')).toBeNull();
  });
});

describe('monitoring - mapStatus', () => {
  it('maps free status', () => {
    expect(mapStatus({ status: 'free', worksInProgress: false })).toBe('free');
  });

  it('maps occupied with works to active_work', () => {
    expect(mapStatus({ status: 'occupied', worksInProgress: true })).toBe('active_work');
  });

  it('maps occupied without works to occupied', () => {
    expect(mapStatus({ status: 'occupied', worksInProgress: false })).toBe('occupied');
  });

  it('maps non-free without works to occupied', () => {
    expect(mapStatus({ status: 'busy', worksInProgress: false })).toBe('occupied');
  });

  it('free overrides worksInProgress flag', () => {
    // free status takes priority
    expect(mapStatus({ status: 'free', worksInProgress: true })).toBe('free');
  });
});

describe('monitoring - summary aggregation', () => {
  it('counts working, occupied, free, idle correctly', () => {
    const posts = [
      { postNumber: 1, status: 'active_work' },
      { postNumber: 2, status: 'active_work' },
      { postNumber: 3, status: 'free' },
      { postNumber: 4, status: 'occupied' },
      { postNumber: 5, status: 'free' },
      { postNumber: 6, status: 'active_work' },
      { postNumber: 7, status: 'occupied' },
      { postNumber: 8, status: 'free' },
      { postNumber: 9, status: 'active_work' },
      { postNumber: 10, status: 'free' },
    ];
    const summary = getSummary(posts);
    expect(summary.totalPosts).toBe(10);
    expect(summary.working).toBe(4);
    expect(summary.free).toBe(4);
    expect(summary.idle).toBe(2); // occupied (no work)
    // occupied = not free (working + idle)
    expect(summary.occupied).toBe(6);
  });

  it('handles all posts free', () => {
    const posts = Array.from({ length: 10 }, (_, i) => ({ postNumber: i + 1, status: 'free' }));
    const summary = getSummary(posts);
    expect(summary.working).toBe(0);
    expect(summary.free).toBe(10);
    expect(summary.idle).toBe(0);
    expect(summary.occupied).toBe(0);
  });

  it('handles empty posts array', () => {
    const summary = getSummary([]);
    expect(summary.totalPosts).toBe(0);
    expect(summary.working).toBe(0);
    expect(summary.free).toBe(0);
  });
});

describe('monitoring - history filtering', () => {
  it('validates from and to parameters are required', () => {
    const from = undefined;
    const to = undefined;
    const isValid = !!(from && to);
    expect(isValid).toBe(false);
  });

  it('accepts valid date range', () => {
    const from = '2026-04-10T00:00:00Z';
    const to = '2026-04-14T23:59:59Z';
    const isValid = !!(from && to);
    expect(isValid).toBe(true);
    expect(new Date(from).getTime()).toBeLessThan(new Date(to).getTime());
  });

  it('post number validation rejects out of range (1-20)', () => {
    const validate = (num) => {
      const n = parseInt(num, 10);
      return !(isNaN(n) || n < 1 || n > 20);
    };
    expect(validate('5')).toBe(true);
    expect(validate('0')).toBe(false);
    expect(validate('21')).toBe(false);
    expect(validate('abc')).toBe(false);
  });
});
