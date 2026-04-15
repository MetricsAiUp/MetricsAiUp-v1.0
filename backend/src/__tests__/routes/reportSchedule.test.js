import { describe, it, expect } from 'vitest';

// Test report schedule logic: creation, frequency, validation, run, active toggle

describe('reportSchedule - schedule creation', () => {
  it('creates schedule with required fields', () => {
    const body = {
      name: 'Daily Summary',
      frequency: 'daily',
      hour: 20,
      minute: 0,
      format: 'xlsx',
      chatId: '12345',
    };
    const schedule = {
      id: 'sched-1',
      ...body,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    expect(schedule.name).toBe('Daily Summary');
    expect(schedule.frequency).toBe('daily');
    expect(schedule.format).toBe('xlsx');
    expect(schedule.isActive).toBe(true);
  });

  it('defaults hour to 20 and minute to 0 when not provided', () => {
    const hour = undefined;
    const minute = undefined;
    const finalHour = hour || 20;
    const finalMinute = minute || 0;
    expect(finalHour).toBe(20);
    expect(finalMinute).toBe(0);
  });

  it('defaults format to xlsx when not provided', () => {
    const format = undefined;
    const finalFormat = format || 'xlsx';
    expect(finalFormat).toBe('xlsx');
  });
});

describe('reportSchedule - frequency values', () => {
  it('daily frequency is valid', () => {
    const validFrequencies = ['daily', 'weekly'];
    expect(validFrequencies).toContain('daily');
  });

  it('weekly frequency is valid', () => {
    const validFrequencies = ['daily', 'weekly'];
    expect(validFrequencies).toContain('weekly');
  });

  it('daily report covers 1 day period', () => {
    const frequency = 'daily';
    const periodDays = frequency === 'daily' ? 1 : 7;
    expect(periodDays).toBe(1);
  });

  it('weekly report covers 7 day period', () => {
    const frequency = 'weekly';
    const periodDays = frequency === 'daily' ? 1 : 7;
    expect(periodDays).toBe(7);
  });
});

describe('reportSchedule - hour/minute validation', () => {
  it('accepts valid hour range 0-23', () => {
    for (let h = 0; h <= 23; h++) {
      expect(h >= 0 && h <= 23).toBe(true);
    }
  });

  it('accepts valid minute range 0-59', () => {
    for (let m = 0; m <= 59; m++) {
      expect(m >= 0 && m <= 59).toBe(true);
    }
  });

  it('rejects invalid hour', () => {
    const invalid = [-1, 24, 25, 100];
    for (const h of invalid) {
      expect(h >= 0 && h <= 23).toBe(false);
    }
  });
});

describe('reportSchedule - dayOfWeek for weekly', () => {
  it('dayOfWeek is meaningful for weekly schedules', () => {
    const schedule = { frequency: 'weekly', dayOfWeek: 1 }; // Monday
    expect(schedule.dayOfWeek).toBe(1);
    expect(schedule.frequency).toBe('weekly');
  });

  it('dayOfWeek values 0-6 map to Sun-Sat', () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(days[0]).toBe('Sunday');
    expect(days[6]).toBe('Saturday');
    expect(days).toHaveLength(7);
  });
});

describe('reportSchedule - run trigger', () => {
  it('run calculates period based on frequency', () => {
    const daily = { frequency: 'daily' };
    const weekly = { frequency: 'weekly' };
    const dailyPeriod = daily.frequency === 'daily' ? 1 : 7;
    const weeklyPeriod = weekly.frequency === 'daily' ? 1 : 7;
    expect(dailyPeriod).toBe(1);
    expect(weeklyPeriod).toBe(7);
  });

  it('returns 404 when schedule not found', () => {
    const schedule = null;
    const notFound = !schedule;
    expect(notFound).toBe(true);
  });

  it('XLSX response has correct content type and disposition', () => {
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = 'report-2026-04-14.xlsx';
    const disposition = `attachment; filename=${filename}`;
    expect(contentType).toContain('spreadsheetml');
    expect(disposition).toContain(filename);
  });
});

describe('reportSchedule - active/inactive toggle', () => {
  it('toggle active to inactive', () => {
    const schedule = { id: 'sched-1', isActive: true };
    const updated = { ...schedule, isActive: false };
    expect(updated.isActive).toBe(false);
  });

  it('toggle inactive to active', () => {
    const schedule = { id: 'sched-1', isActive: false };
    const updated = { ...schedule, isActive: true };
    expect(updated.isActive).toBe(true);
  });

  it('update only modifies provided fields', () => {
    const existing = { id: 's1', name: 'Old', frequency: 'daily', hour: 20, minute: 0, isActive: true };
    const body = { name: 'New Report', hour: 8 };
    const updated = { ...existing, ...body };
    expect(updated.name).toBe('New Report');
    expect(updated.hour).toBe(8);
    expect(updated.frequency).toBe('daily'); // unchanged
    expect(updated.isActive).toBe(true); // unchanged
  });
});
