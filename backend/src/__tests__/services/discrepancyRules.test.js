import { describe, it, expect } from 'vitest';
import {
  RULES,
  noShowInCv,
  noShowIn1C,
  wrongPost,
  overstatedNormHours,
  understatedActualTime,
  timeMismatch,
} from '../../services/discrepancyRules.js';

describe('discrepancyRules — RULES export', () => {
  it('exports 6 rules in expected order', () => {
    expect(RULES).toHaveLength(6);
    expect(RULES.map((r) => r.name)).toEqual([
      'noShowInCv', 'noShowIn1C', 'wrongPost',
      'overstatedNormHours', 'understatedActualTime', 'timeMismatch',
    ]);
  });
});

describe('discrepancyRules — noShowInCv', () => {
  const baseOrder = { orderNumber: 'WO-1', state: 'Закрыт', plateNumber: 'A123BC', vin: 'V1', scheduledStart: new Date('2026-04-14T08:00:00Z') };
  it('returns null when CV has any match', () => {
    expect(noShowInCv({ order: baseOrder, match: { matchType: 'vin' } })).toBeNull();
    expect(noShowInCv({ order: baseOrder, match: { matchType: 'exact_plate' } })).toBeNull();
  });
  it('returns null when order not in Закрыт/В работе', () => {
    expect(noShowInCv({ order: { ...baseOrder, state: 'Новый' }, match: { matchType: 'none' } })).toBeNull();
  });
  it('returns null when neither plate nor VIN set', () => {
    expect(noShowInCv({ order: { ...baseOrder, plateNumber: null, vin: null }, match: { matchType: 'none' } })).toBeNull();
  });
  it('returns critical draft when conditions met', () => {
    const r = noShowInCv({ order: baseOrder, match: { matchType: 'none' } });
    expect(r).not.toBeNull();
    expect(r.type).toBe('no_show_in_cv');
    expect(r.severity).toBe('critical');
    expect(r.cvValue).toBeNull();
    expect(r.oneCValue.state).toBe('Закрыт');
  });
});

describe('discrepancyRules — noShowIn1C', () => {
  const post = { id: 'p1', number: 1, isTracked: true };
  const postStay = {
    id: 'ps1', postId: 'p1',
    startTime: new Date('2026-04-14T10:00:00Z'),
    endTime: new Date('2026-04-14T12:00:00Z'),
    activeTime: 3600, idleTime: 600,
  };
  it('returns null when post not tracked', () => {
    expect(noShowIn1C({ postStay, post: { ...post, isTracked: false }, stages: [], anchor: null })).toBeNull();
  });
  it('returns null when total < 30 min', () => {
    const short = { ...postStay, activeTime: 600, idleTime: 600 };
    expect(noShowIn1C({ postStay: short, post, stages: [], anchor: null })).toBeNull();
  });
  it('returns null when matching 1C stage exists within window', () => {
    const stages = [{ postId: 'p1', scheduledStart: new Date('2026-04-14T11:00:00Z') }];
    expect(noShowIn1C({ postStay, post, stages, anchor: null })).toBeNull();
  });
  it('returns warning draft when no 1C stage found', () => {
    const r = noShowIn1C({ postStay, post, stages: [], anchor: null });
    expect(r).not.toBeNull();
    expect(r.type).toBe('no_show_in_1c');
    expect(r.severity).toBe('warning');
    expect(r.postId).toBe('p1');
  });
});

describe('discrepancyRules — wrongPost', () => {
  const order = { orderNumber: 'WO-1' };
  const postStay = { id: 'ps1', postId: 'p1', startTime: new Date('2026-04-14T10:00:00Z') };
  it('returns null when CV has no match', () => {
    expect(wrongPost({ order, postStay, match: { matchType: 'none' }, stages: [] })).toBeNull();
  });
  it('returns null when no 1C stage for orderNumber', () => {
    expect(wrongPost({ order, postStay, match: { matchType: 'vin' }, stages: [] })).toBeNull();
  });
  it('returns null when 1C stage postId equals CV postId', () => {
    const stages = [{ orderNumber: 'WO-1', postId: 'p1', scheduledStart: new Date('2026-04-14T10:30:00Z'), postRawName: 'Пост 1' }];
    expect(wrongPost({ order, postStay, match: { matchType: 'vin' }, stages })).toBeNull();
  });
  it('returns warning draft when postIds differ', () => {
    const stages = [{ orderNumber: 'WO-1', postId: 'p2', scheduledStart: new Date('2026-04-14T10:30:00Z'), postRawName: 'Пост 2' }];
    const r = wrongPost({ order, postStay, match: { matchType: 'vin' }, stages });
    expect(r.type).toBe('wrong_post');
    expect(r.severity).toBe('warning');
    expect(r.postId).toBe('p2');
  });
});

describe('discrepancyRules — overstatedNormHours', () => {
  const order = { orderNumber: 'WO-1', normHours: 3 };
  it('returns null when no postStay', () => {
    expect(overstatedNormHours({ order, postStay: null })).toBeNull();
  });
  it('returns null when activeTime is 0', () => {
    expect(overstatedNormHours({ order, postStay: { activeTime: 0 } })).toBeNull();
  });
  it('returns null when within 1.5× threshold', () => {
    // 3h norm, 2.5h active → 3 <= 1.5*2.5 = 3.75 → no
    expect(overstatedNormHours({ order, postStay: { activeTime: 2.5 * 3600 } })).toBeNull();
  });
  it('returns critical draft when norm overstates active time >1.5×', () => {
    // 3h norm, 1h active → 3 > 1.5
    const r = overstatedNormHours({ order, postStay: { activeTime: 3600, startTime: new Date() } });
    expect(r).not.toBeNull();
    expect(r.type).toBe('overstated_norm_hours');
    expect(r.severity).toBe('critical');
  });
});

describe('discrepancyRules — understatedActualTime', () => {
  const order = { orderNumber: 'WO-1', normHours: 1 };
  it('returns null when within 1.5× threshold', () => {
    // 1h norm, 1.4h active → 1.4 <= 1.5 → no
    expect(understatedActualTime({ order, postStay: { activeTime: 1.4 * 3600 } })).toBeNull();
  });
  it('returns warning draft when CV time exceeds 1.5× norm', () => {
    // 1h norm, 2h active → 2 > 1.5
    const r = understatedActualTime({ order, postStay: { activeTime: 2 * 3600, startTime: new Date() } });
    expect(r).not.toBeNull();
    expect(r.type).toBe('understated_actual_time');
    expect(r.severity).toBe('warning');
  });
});

describe('discrepancyRules — timeMismatch', () => {
  it('returns null when missing endTime or closedAt', () => {
    expect(timeMismatch({ order: { closedAt: null }, postStay: { endTime: new Date() } })).toBeNull();
    expect(timeMismatch({ order: { closedAt: new Date() }, postStay: { endTime: null } })).toBeNull();
  });
  it('returns null when diff ≤ 60 min', () => {
    const t = new Date('2026-04-14T12:00:00Z');
    const order = { orderNumber: 'WO-1', closedAt: new Date(t.getTime() + 30 * 60 * 1000) };
    const postStay = { id: 'p', endTime: t };
    expect(timeMismatch({ order, postStay })).toBeNull();
  });
  it('returns warning draft when diff > 60 min', () => {
    const t = new Date('2026-04-14T12:00:00Z');
    const order = { orderNumber: 'WO-1', closedAt: new Date(t.getTime() + 2 * 60 * 60 * 1000) };
    const postStay = { id: 'p', endTime: t };
    const r = timeMismatch({ order, postStay });
    expect(r.type).toBe('time_mismatch');
    expect(r.severity).toBe('warning');
    expect(r.description).toMatch(/120 мин/);
  });
});
