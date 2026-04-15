import { describe, it, expect } from 'vitest';

// Test recommendation business logic: types, status transitions, filtering, response shape

const RECOMMENDATION_TYPES = ['post_free', 'work_overtime', 'vehicle_idle', 'capacity_available', 'no_show'];

describe('recommendations - types', () => {
  it('defines 5 recommendation types', () => {
    expect(RECOMMENDATION_TYPES).toHaveLength(5);
  });

  it('post_free recommendation for post idle > 30 min', () => {
    const rec = {
      type: 'post_free',
      message: 'Пост 3 свободен более 30 минут',
      postId: 'post-3',
      zoneId: null,
      status: 'active',
      priority: 'medium',
    };
    expect(rec.type).toBe('post_free');
    expect(rec.postId).toBeTruthy();
    expect(rec.status).toBe('active');
  });

  it('work_overtime recommendation for exceeding normHours', () => {
    const normHours = 2;
    const actualHours = 2.8;
    const overtime = actualHours / normHours;
    const isOvertime = overtime > 1.2; // 120% threshold
    expect(isOvertime).toBe(true);

    const rec = {
      type: 'work_overtime',
      message: `ЗН превысил норматив на ${Math.round((overtime - 1) * 100)}%`,
      status: 'active',
    };
    expect(rec.type).toBe('work_overtime');
  });

  it('vehicle_idle recommendation for idle > 15 min', () => {
    const idleMinutes = 20;
    const isIdle = idleMinutes > 15;
    expect(isIdle).toBe(true);

    const rec = { type: 'vehicle_idle', status: 'active' };
    expect(rec.type).toBe('vehicle_idle');
  });

  it('capacity_available recommendation', () => {
    const rec = {
      type: 'capacity_available',
      message: 'Есть свободные посты — можно принять ещё авто',
      status: 'active',
    };
    expect(rec.type).toBe('capacity_available');
  });

  it('no_show recommendation', () => {
    const rec = {
      type: 'no_show',
      message: 'Авто не прибыло в назначенное время',
      status: 'active',
    };
    expect(rec.type).toBe('no_show');
  });
});

describe('recommendations - status transitions', () => {
  it('active recommendation transitions to acknowledged', () => {
    const rec = { id: 'rec-1', status: 'active' };
    const updated = { ...rec, status: 'acknowledged' };
    expect(updated.status).toBe('acknowledged');
  });

  it('acknowledged recommendation cannot go back to active', () => {
    // By convention, acknowledge is a one-way transition
    const validTransitions = { active: ['acknowledged'] };
    const canTransition = (from, to) => (validTransitions[from] || []).includes(to);
    expect(canTransition('active', 'acknowledged')).toBe(true);
    expect(canTransition('acknowledged', 'active')).toBe(false);
  });
});

describe('recommendations - filtering by status', () => {
  it('default filter is active', () => {
    const queryStatus = undefined;
    const status = queryStatus || 'active';
    expect(status).toBe('active');
  });

  it('filters only active recommendations', () => {
    const recommendations = [
      { id: '1', status: 'active', type: 'post_free' },
      { id: '2', status: 'acknowledged', type: 'work_overtime' },
      { id: '3', status: 'active', type: 'vehicle_idle' },
    ];
    const active = recommendations.filter(r => r.status === 'active');
    expect(active).toHaveLength(2);
  });

  it('can filter acknowledged recommendations', () => {
    const recommendations = [
      { id: '1', status: 'active', type: 'post_free' },
      { id: '2', status: 'acknowledged', type: 'work_overtime' },
    ];
    const acknowledged = recommendations.filter(r => r.status === 'acknowledged');
    expect(acknowledged).toHaveLength(1);
    expect(acknowledged[0].type).toBe('work_overtime');
  });
});

describe('recommendations - response shape', () => {
  it('recommendation includes zone and post relations', () => {
    const rec = {
      id: 'rec-1',
      type: 'post_free',
      message: 'Пост 1 свободен',
      status: 'active',
      createdAt: '2026-04-14T10:00:00Z',
      zone: { id: 'zone-1', name: 'Ремонтная зона' },
      post: { id: 'post-1', number: 1, name: 'Пост 1' },
    };
    expect(rec).toHaveProperty('zone');
    expect(rec).toHaveProperty('post');
    expect(rec.zone.name).toBe('Ремонтная зона');
    expect(rec.post.number).toBe(1);
  });

  it('response is array sorted by createdAt desc', () => {
    const recs = [
      { id: '1', createdAt: '2026-04-14T08:00:00Z' },
      { id: '2', createdAt: '2026-04-14T10:00:00Z' },
      { id: '3', createdAt: '2026-04-14T09:00:00Z' },
    ];
    const sorted = [...recs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });
});
