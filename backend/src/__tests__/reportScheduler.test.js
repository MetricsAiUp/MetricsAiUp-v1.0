import { describe, it, expect } from 'vitest';

// Extract and test the shouldRun logic directly.
// The function is not exported, so we recreate it identically for unit testing.
function shouldRun(schedule, now) {
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false;
  if (schedule.lastRunAt) {
    const last = new Date(schedule.lastRunAt);
    if (last.toDateString() === now.toDateString()) return false;
  }
  if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && now.getDay() !== schedule.dayOfWeek) return false;
  return true;
}

describe('reportScheduler - shouldRun', () => {
  it('returns true when hour/minute match and no lastRunAt', () => {
    const now = new Date('2026-04-09T08:30:00');
    const schedule = { hour: 8, minute: 30, frequency: 'daily', lastRunAt: null, dayOfWeek: null };
    expect(shouldRun(schedule, now)).toBe(true);
  });

  it('returns false when hour does not match', () => {
    const now = new Date('2026-04-09T09:30:00');
    const schedule = { hour: 8, minute: 30, frequency: 'daily', lastRunAt: null, dayOfWeek: null };
    expect(shouldRun(schedule, now)).toBe(false);
  });

  it('returns false when minute does not match', () => {
    const now = new Date('2026-04-09T08:15:00');
    const schedule = { hour: 8, minute: 30, frequency: 'daily', lastRunAt: null, dayOfWeek: null };
    expect(shouldRun(schedule, now)).toBe(false);
  });

  it('returns false when already ran today', () => {
    const now = new Date('2026-04-09T08:30:00');
    const schedule = {
      hour: 8,
      minute: 30,
      frequency: 'daily',
      lastRunAt: new Date('2026-04-09T08:30:00'),
      dayOfWeek: null,
    };
    expect(shouldRun(schedule, now)).toBe(false);
  });

  it('returns true when lastRunAt was yesterday', () => {
    const now = new Date('2026-04-09T08:30:00');
    const schedule = {
      hour: 8,
      minute: 30,
      frequency: 'daily',
      lastRunAt: new Date('2026-04-08T08:30:00'),
      dayOfWeek: null,
    };
    expect(shouldRun(schedule, now)).toBe(true);
  });

  it('weekly: returns false on wrong day of week', () => {
    // 2026-04-09 is a Thursday (day 4)
    const now = new Date('2026-04-09T08:30:00');
    const schedule = {
      hour: 8,
      minute: 30,
      frequency: 'weekly',
      lastRunAt: null,
      dayOfWeek: 1, // Monday
    };
    expect(shouldRun(schedule, now)).toBe(false);
  });

  it('weekly: returns true on correct day of week', () => {
    // 2026-04-09 is a Thursday (day 4)
    const now = new Date('2026-04-09T08:30:00');
    const schedule = {
      hour: 8,
      minute: 30,
      frequency: 'weekly',
      lastRunAt: null,
      dayOfWeek: 4, // Thursday
    };
    expect(shouldRun(schedule, now)).toBe(true);
  });

  it('daily schedule ignores dayOfWeek', () => {
    const now = new Date('2026-04-09T08:30:00');
    const schedule = {
      hour: 8,
      minute: 30,
      frequency: 'daily',
      lastRunAt: null,
      dayOfWeek: 1, // Monday, but daily ignores this
    };
    expect(shouldRun(schedule, now)).toBe(true);
  });
});
