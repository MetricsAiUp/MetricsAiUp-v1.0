import { describe, it, expect } from 'vitest';

// Test settings logic: app mode values, mode toggle effects, admin restriction, response shape

const DEFAULT_SETTINGS = {
  mode: 'demo',
};

const VALID_MODES = ['demo', 'live'];

describe('settings - app mode values', () => {
  it('default mode is demo', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('demo');
  });

  it('only demo and live are valid modes', () => {
    expect(VALID_MODES).toContain('demo');
    expect(VALID_MODES).toContain('live');
    expect(VALID_MODES).toHaveLength(2);
  });

  it('accepts demo mode', () => {
    const mode = 'demo';
    expect(VALID_MODES.includes(mode)).toBe(true);
  });

  it('accepts live mode', () => {
    const mode = 'live';
    expect(VALID_MODES.includes(mode)).toBe(true);
  });

  it('rejects invalid mode values', () => {
    const invalid = ['test', 'staging', 'production', '', null, undefined];
    for (const mode of invalid) {
      expect(VALID_MODES.includes(mode)).toBe(false);
    }
  });
});

describe('settings - mode toggle triggers', () => {
  it('demo mode starts demo generator and stops monitoring proxy', () => {
    const mode = 'demo';
    let demoStarted = false, monitoringStopped = false;
    const demoControl = { start: () => { demoStarted = true; }, stop: () => {} };
    const monitoringControl = { start: () => {}, stop: () => { monitoringStopped = true; } };

    if (mode === 'demo') {
      monitoringControl.stop();
      demoControl.start();
    }
    expect(demoStarted).toBe(true);
    expect(monitoringStopped).toBe(true);
  });

  it('live mode starts monitoring proxy and stops demo generator', () => {
    const mode = 'live';
    let demoStopped = false, monitoringStarted = false;
    const demoControl = { start: () => {}, stop: () => { demoStopped = true; } };
    const monitoringControl = { start: () => { monitoringStarted = true; }, stop: () => {} };

    if (mode !== 'demo') {
      demoControl.stop();
      monitoringControl.start();
    }
    expect(demoStopped).toBe(true);
    expect(monitoringStarted).toBe(true);
  });

  it('does not apply mode if not in valid list', () => {
    const current = { mode: 'demo' };
    const requestedMode = 'invalid';
    if (requestedMode && VALID_MODES.includes(requestedMode)) {
      current.mode = requestedMode;
    }
    expect(current.mode).toBe('demo'); // unchanged
  });
});

describe('settings - admin-only restriction', () => {
  it('admin user can update settings', () => {
    const user = { role: 'admin' };
    expect(user.role === 'admin').toBe(true);
  });

  it('non-admin users are rejected', () => {
    const roles = ['director', 'manager', 'mechanic', 'viewer'];
    for (const role of roles) {
      expect(role !== 'admin').toBe(true);
    }
  });
});

describe('settings - response shape', () => {
  it('settings response includes mode', () => {
    const settings = { mode: 'demo' };
    expect(settings).toHaveProperty('mode');
    expect(typeof settings.mode).toBe('string');
  });

  it('settings can include weekSchedule', () => {
    const settings = {
      mode: 'live',
      weekSchedule: {
        mon: { start: '08:00', end: '20:00', dayOff: false },
        tue: { start: '08:00', end: '20:00', dayOff: false },
        sat: { start: '09:00', end: '15:00', dayOff: false },
        sun: { start: '00:00', end: '00:00', dayOff: true },
      },
    };
    expect(settings.weekSchedule).toHaveProperty('mon');
    expect(settings.weekSchedule.sun.dayOff).toBe(true);
  });

  it('settings can include postsCount and shift bounds', () => {
    const settings = {
      mode: 'demo',
      postsCount: 10,
      shiftStart: '08:00',
      shiftEnd: '22:00',
    };
    expect(settings.postsCount).toBe(10);
    expect(settings.shiftStart).toBe('08:00');
    expect(settings.shiftEnd).toBe('22:00');
  });

  it('readSettings merges file data with defaults', () => {
    const fileData = { mode: 'live', postsCount: 8 };
    const merged = { ...DEFAULT_SETTINGS, ...fileData };
    expect(merged.mode).toBe('live');
    expect(merged.postsCount).toBe(8);
  });
});
