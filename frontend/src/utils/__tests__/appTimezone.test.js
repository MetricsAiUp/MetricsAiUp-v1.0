import { describe, it, expect, beforeEach, vi } from 'vitest';

// Reset module cache between tests because module holds singleton state.
let mod;
beforeEach(async () => {
  try { localStorage.clear(); } catch {}
  vi.resetModules();
  mod = await import('../appTimezone.js');
});

describe('appTimezone — getAppTimezone()', () => {
  it('falls back to Europe/Moscow when nothing in storage', () => {
    expect(mod.getAppTimezone()).toBe('Europe/Moscow');
  });

  it('returns value from localStorage when present', async () => {
    localStorage.setItem('appTimezone', 'Europe/London');
    vi.resetModules();
    mod = await import('../appTimezone.js');
    expect(mod.getAppTimezone()).toBe('Europe/London');
  });
});

describe('appTimezone — setAppTimezone()', () => {
  it('persists valid timezone to storage and updates getter', () => {
    mod.setAppTimezone('America/New_York');
    expect(mod.getAppTimezone()).toBe('America/New_York');
    expect(localStorage.getItem('appTimezone')).toBe('America/New_York');
  });

  it('silently rejects invalid timezone', () => {
    mod.setAppTimezone('America/New_York');
    mod.setAppTimezone('Not/Real/TZ');
    expect(mod.getAppTimezone()).toBe('America/New_York'); // unchanged
  });

  it('rejects non-string input', () => {
    mod.setAppTimezone('America/New_York');
    mod.setAppTimezone(null);
    mod.setAppTimezone(123);
    expect(mod.getAppTimezone()).toBe('America/New_York');
  });
});

describe('appTimezone — dateStrInAppTz()', () => {
  it('returns YYYY-MM-DD in the requested TZ', () => {
    const d = new Date('2026-04-14T22:00:00Z');
    expect(mod.dateStrInAppTz(d, 'Europe/Moscow')).toBe('2026-04-15'); // UTC+3 → next day
    expect(mod.dateStrInAppTz(d, 'America/New_York')).toBe('2026-04-14'); // EDT UTC-4
  });

  it('uses configured app TZ when tz arg omitted', () => {
    mod.setAppTimezone('Europe/London');
    const d = new Date('2026-04-14T10:00:00Z');
    expect(mod.dateStrInAppTz(d)).toBe('2026-04-14');
  });
});

describe('appTimezone — dayOfWeekInAppTz()', () => {
  it('returns 0..6 (Sun..Sat) for a known date', () => {
    // 2026-04-14 is Tuesday → 2
    const d = new Date('2026-04-14T12:00:00Z');
    expect(mod.dayOfWeekInAppTz(d, 'UTC')).toBe(2);
  });
});

describe('appTimezone — addDaysInAppTz()', () => {
  it('adds N days to YYYY-MM-DD in given TZ', () => {
    expect(mod.addDaysInAppTz('2026-04-14', 1, 'Europe/Moscow')).toBe('2026-04-15');
    expect(mod.addDaysInAppTz('2026-04-14', 7, 'Europe/Moscow')).toBe('2026-04-21');
    expect(mod.addDaysInAppTz('2026-04-14', -1, 'Europe/Moscow')).toBe('2026-04-13');
  });

  it('handles month/year rollover correctly', () => {
    expect(mod.addDaysInAppTz('2026-04-30', 1, 'Europe/Moscow')).toBe('2026-05-01');
    expect(mod.addDaysInAppTz('2026-12-31', 1, 'Europe/Moscow')).toBe('2027-01-01');
  });
});

describe('appTimezone — formatDateTimeInAppTz()', () => {
  it('returns em-dash for empty input', () => {
    expect(mod.formatDateTimeInAppTz(null)).toBe('—');
    expect(mod.formatDateTimeInAppTz('')).toBe('—');
  });

  it('formats ISO string with date+time in requested TZ', () => {
    const out = mod.formatDateTimeInAppTz('2026-04-14T10:30:00Z', 'ru-RU', 'Europe/Moscow');
    // ru-RU dd.mm.yyyy, hh:mm — content varies by Node, but must contain "14.04.2026" and "13:30"
    expect(out).toMatch(/14\.04\.2026/);
    expect(out).toMatch(/13:30/);
  });

  it('falls back to string representation on bad input', () => {
    expect(mod.formatDateTimeInAppTz('not-a-date')).toBeDefined();
  });
});

describe('appTimezone — formatInAppTz()', () => {
  it('returns em-dash for empty input', () => {
    expect(mod.formatInAppTz(null)).toBe('—');
    expect(mod.formatInAppTz('')).toBe('—');
  });

  it('uses default opts (date+time) when options omitted', () => {
    const out = mod.formatInAppTz('2026-04-14T10:30:00Z', null, 'ru-RU', 'Europe/Moscow');
    expect(out).toMatch(/14\.04\.2026/);
    expect(out).toMatch(/13:30/);
  });

  it('honors override options (time-only)', () => {
    const out = mod.formatInAppTz(
      '2026-04-14T10:30:00Z',
      { hour: '2-digit', minute: '2-digit' },
      'ru-RU',
      'Europe/Moscow',
    );
    expect(out).toBe('13:30');
  });

  it('accepts Date instance directly', () => {
    const out = mod.formatInAppTz(
      new Date('2026-04-14T10:30:00Z'),
      { hour: '2-digit', minute: '2-digit' },
      'ru-RU',
      'Europe/Moscow',
    );
    expect(out).toBe('13:30');
  });

  it('falls back to string for invalid date', () => {
    expect(mod.formatInAppTz('garbage')).toBe('garbage');
  });
});

describe('appTimezone — formatDateInAppTz / formatTimeInAppTz / formatTimeSecInAppTz', () => {
  it('formatDateInAppTz produces DD.MM.YYYY in TZ', () => {
    const out = mod.formatDateInAppTz('2026-04-14T22:30:00Z', 'ru-RU', 'Europe/Moscow');
    // 22:30 UTC = 01:30 Москва (15 апр)
    expect(out).toBe('15.04.2026');
  });

  it('formatTimeInAppTz produces HH:MM in TZ', () => {
    const out = mod.formatTimeInAppTz('2026-04-14T10:30:00Z', 'ru-RU', 'Europe/Moscow');
    expect(out).toBe('13:30');
  });

  it('formatTimeSecInAppTz includes seconds', () => {
    const out = mod.formatTimeSecInAppTz('2026-04-14T10:30:45Z', 'ru-RU', 'Europe/Moscow');
    expect(out).toBe('13:30:45');
  });
});
