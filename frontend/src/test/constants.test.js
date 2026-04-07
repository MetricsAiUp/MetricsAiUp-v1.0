import { describe, it, expect } from 'vitest';
import { POST_STATUS_COLORS, WO_STATUS_COLORS, EVENT_TYPES, ALL_CAMERAS, ZONE_TYPE_COLORS, POLLING_INTERVAL } from '../constants';

describe('POST_STATUS_COLORS', () => {
  it('has all 4 post statuses', () => {
    expect(POST_STATUS_COLORS).toHaveProperty('free');
    expect(POST_STATUS_COLORS).toHaveProperty('occupied');
    expect(POST_STATUS_COLORS).toHaveProperty('occupied_no_work');
    expect(POST_STATUS_COLORS).toHaveProperty('active_work');
  });

  it('all values are hex colors', () => {
    Object.values(POST_STATUS_COLORS).forEach(c => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('WO_STATUS_COLORS', () => {
  it('has all work order statuses', () => {
    ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'overdue'].forEach(s => {
      expect(WO_STATUS_COLORS).toHaveProperty(s);
    });
  });
});

describe('EVENT_TYPES', () => {
  it('has both ru and en for each type', () => {
    Object.values(EVENT_TYPES).forEach(et => {
      expect(et).toHaveProperty('ru');
      expect(et).toHaveProperty('en');
      expect(et).toHaveProperty('color');
    });
  });

  it('has 10 event types', () => {
    expect(Object.keys(EVENT_TYPES).length).toBe(10);
  });
});

describe('ALL_CAMERAS', () => {
  it('has 15 cameras', () => {
    expect(ALL_CAMERAS).toHaveLength(15);
  });

  it('each camera has required fields', () => {
    ALL_CAMERAS.forEach(cam => {
      expect(cam).toHaveProperty('id');
      expect(cam).toHaveProperty('name');
      expect(cam).toHaveProperty('location');
      expect(cam).toHaveProperty('coverage');
    });
  });
});

describe('ZONE_TYPE_COLORS', () => {
  it('has all zone types', () => {
    ['repair', 'entry', 'parking', 'waiting', 'diagnostics'].forEach(t => {
      expect(ZONE_TYPE_COLORS).toHaveProperty(t);
    });
  });
});

describe('POLLING_INTERVAL', () => {
  it('is 5000ms', () => {
    expect(POLLING_INTERVAL).toBe(5000);
  });
});
