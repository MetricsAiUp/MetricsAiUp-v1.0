import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../config/database');

const rules = require('../../services/discrepancyRules');

// --- Тесты правил (pure functions) -----------------------------------------

describe('discrepancyRules — 6 правил детекции', () => {
  const baseOrder = {
    orderNumber: 'ЗН-001',
    plateNumber: 'А123ББ77',
    state: 'Закрыт',
    normHours: 2,
    closedAt: new Date('2026-05-06T15:00:00Z'),
  };
  const baseStay = (overrides = {}) => ({
    id: 'st1',
    postId: 'p1',
    startTime: new Date('2026-05-06T10:00:00Z'),
    endTime: new Date('2026-05-06T15:00:00Z'),
    activeTime: 2 * 3600, // 2 часа
    idleTime: 0,
    hasWorker: true,
    ...overrides,
  });

  describe('noShowInCv', () => {
    it('Закрыт + есть plate + matchType=none → critical', () => {
      const r = rules.noShowInCv({ order: baseOrder, match: { matchType: 'none' } });
      expect(r).not.toBeNull();
      expect(r.type).toBe('no_show_in_cv');
      expect(r.severity).toBe('critical');
    });

    it('matchType=exact_plate → null', () => {
      const r = rules.noShowInCv({ order: baseOrder, match: { matchType: 'exact_plate' } });
      expect(r).toBeNull();
    });

    it('state=Запланирован → null (только Закрыт/В работе)', () => {
      const r = rules.noShowInCv({ order: { ...baseOrder, state: 'Запланирован' }, match: { matchType: 'none' } });
      expect(r).toBeNull();
    });

    it('нет ни plate, ни VIN → null', () => {
      const r = rules.noShowInCv({ order: { ...baseOrder, plateNumber: null, vin: null }, match: { matchType: 'none' } });
      expect(r).toBeNull();
    });
  });

  describe('noShowIn1C', () => {
    const post = { id: 'p1', isTracked: true, number: 1 };

    it('CV stay > 30 мин на tracked-посту, нет 1С stage → warning', () => {
      const r = rules.noShowIn1C({
        postStay: baseStay(),
        post,
        stages: [],
      });
      expect(r).not.toBeNull();
      expect(r.type).toBe('no_show_in_1c');
      expect(r.severity).toBe('warning');
      expect(r.postId).toBe('p1');
    });

    it('post.isTracked=false → null (не наш пост)', () => {
      const r = rules.noShowIn1C({
        postStay: baseStay(),
        post: { ...post, isTracked: false },
        stages: [],
      });
      expect(r).toBeNull();
    });

    it('CV stay < 30 мин → null', () => {
      const r = rules.noShowIn1C({
        postStay: baseStay({ activeTime: 10 * 60, idleTime: 0 }),
        post,
        stages: [],
      });
      expect(r).toBeNull();
    });

    it('есть matching 1С stage в окне 4ч → null', () => {
      const r = rules.noShowIn1C({
        postStay: baseStay(),
        post,
        stages: [{ postId: 'p1', scheduledStart: new Date('2026-05-06T11:00:00Z'), orderNumber: 'ЗН-001' }],
      });
      expect(r).toBeNull();
    });

    it('1С stage на другом посту → не считается → warning', () => {
      const r = rules.noShowIn1C({
        postStay: baseStay(),
        post,
        stages: [{ postId: 'p2', scheduledStart: new Date('2026-05-06T11:00:00Z'), orderNumber: 'ЗН-002' }],
      });
      expect(r).not.toBeNull();
    });
  });

  describe('wrongPost', () => {
    it('CV postStay.postId != 1С stage.postId → warning', () => {
      const r = rules.wrongPost({
        order: baseOrder,
        postStay: baseStay({ postId: 'p2' }),
        match: { matchType: 'exact_plate' },
        stages: [{
          orderNumber: 'ЗН-001',
          postId: 'p1',
          postRawName: 'ПОСТ 1',
          scheduledStart: new Date('2026-05-06T10:30:00Z'),
        }],
      });
      expect(r).not.toBeNull();
      expect(r.type).toBe('wrong_post');
      expect(r.postId).toBe('p1'); // привязка к 1С-посту
    });

    it('match=none → null', () => {
      const r = rules.wrongPost({
        order: baseOrder,
        postStay: baseStay({ postId: 'p2' }),
        match: { matchType: 'none' },
        stages: [],
      });
      expect(r).toBeNull();
    });

    it('1С stage.postId === CV stay.postId → null', () => {
      const r = rules.wrongPost({
        order: baseOrder,
        postStay: baseStay({ postId: 'p1' }),
        match: { matchType: 'exact_plate' },
        stages: [{
          orderNumber: 'ЗН-001',
          postId: 'p1',
          postRawName: 'ПОСТ 1',
          scheduledStart: new Date('2026-05-06T10:30:00Z'),
        }],
      });
      expect(r).toBeNull();
    });

    it('нет stage в окне → null', () => {
      const r = rules.wrongPost({
        order: baseOrder,
        postStay: baseStay({ postId: 'p2' }),
        match: { matchType: 'exact_plate' },
        stages: [{
          orderNumber: 'ЗН-001',
          postId: 'p1',
          postRawName: 'ПОСТ 1',
          scheduledStart: new Date('2026-05-07T20:00:00Z'), // далеко
        }],
      });
      expect(r).toBeNull();
    });
  });

  describe('overstatedNormHours', () => {
    it('1С norm 5ч, CV active 2ч (>1.5x) → critical', () => {
      const r = rules.overstatedNormHours({
        order: { ...baseOrder, normHours: 5 },
        postStay: baseStay({ activeTime: 2 * 3600 }),
      });
      expect(r).not.toBeNull();
      expect(r.severity).toBe('critical');
    });

    it('1С norm 2ч, CV active 2ч (1x) → null', () => {
      const r = rules.overstatedNormHours({
        order: { ...baseOrder, normHours: 2 },
        postStay: baseStay({ activeTime: 2 * 3600 }),
      });
      expect(r).toBeNull();
    });

    it('CV active = 0 → null', () => {
      const r = rules.overstatedNormHours({
        order: { ...baseOrder, normHours: 5 },
        postStay: baseStay({ activeTime: 0 }),
      });
      expect(r).toBeNull();
    });
  });

  describe('understatedActualTime', () => {
    it('CV active 5ч, 1С norm 2ч → warning', () => {
      const r = rules.understatedActualTime({
        order: { ...baseOrder, normHours: 2 },
        postStay: baseStay({ activeTime: 5 * 3600 }),
      });
      expect(r).not.toBeNull();
      expect(r.type).toBe('understated_actual_time');
    });

    it('CV active 2ч, norm 2ч → null', () => {
      const r = rules.understatedActualTime({
        order: { ...baseOrder, normHours: 2 },
        postStay: baseStay({ activeTime: 2 * 3600 }),
      });
      expect(r).toBeNull();
    });
  });

  describe('timeMismatch', () => {
    it('1С closedAt vs CV endTime, разница > 60 мин → warning', () => {
      const r = rules.timeMismatch({
        order: { ...baseOrder, closedAt: new Date('2026-05-06T15:00:00Z') },
        postStay: baseStay({ endTime: new Date('2026-05-06T17:00:00Z') }),
      });
      expect(r).not.toBeNull();
      expect(r.type).toBe('time_mismatch');
    });

    it('разница 30 мин → null', () => {
      const r = rules.timeMismatch({
        order: { ...baseOrder, closedAt: new Date('2026-05-06T15:00:00Z') },
        postStay: baseStay({ endTime: new Date('2026-05-06T15:30:00Z') }),
      });
      expect(r).toBeNull();
    });

    it('postStay.endTime null → null', () => {
      const r = rules.timeMismatch({
        order: baseOrder,
        postStay: baseStay({ endTime: null }),
      });
      expect(r).toBeNull();
    });
  });
});

// --- Тест upsertDiscrepancy --------------------------------------------------

describe('discrepancyDetector — upsertDiscrepancy', () => {
  const spies = {};
  function setupSpies() {
    spies.findFirst = vi.spyOn(prisma.discrepancy, 'findFirst');
    spies.update = vi.spyOn(prisma.discrepancy, 'update');
    spies.create = vi.spyOn(prisma.discrepancy, 'create');
  }
  setupSpies();

  // Импортируем после spy setup, чтобы перехватить prisma calls
  const detector = require('../../services/discrepancyDetector');

  beforeEach(() => {
    vi.clearAllMocks();
    setupSpies();
  });

  it('новая запись → create + isNew=true', async () => {
    spies.findFirst.mockResolvedValueOnce(null);
    spies.create.mockResolvedValueOnce({ id: 'd1', type: 'no_show_in_cv', status: 'open' });
    const r = await detector._upsertDiscrepancy({
      type: 'no_show_in_cv',
      orderNumber: 'ЗН-001',
      severity: 'critical',
      description: 'desc',
    });
    expect(r.isNew).toBe(true);
    expect(spies.create).toHaveBeenCalledOnce();
  });

  it('существующая open → update + isNew=false', async () => {
    spies.findFirst.mockResolvedValueOnce({ id: 'd1', status: 'open' });
    spies.update.mockResolvedValueOnce({ id: 'd1' });
    const r = await detector._upsertDiscrepancy({
      type: 'no_show_in_cv',
      orderNumber: 'ЗН-001',
      severity: 'critical',
      description: 'desc updated',
    });
    expect(r.isNew).toBe(false);
    expect(r.updated).toBe(true);
    expect(spies.update).toHaveBeenCalledOnce();
  });

  it('существующая resolved → не трогаем, updated=false', async () => {
    spies.findFirst.mockResolvedValueOnce({ id: 'd1', status: 'resolved' });
    const r = await detector._upsertDiscrepancy({
      type: 'no_show_in_cv',
      orderNumber: 'ЗН-001',
      severity: 'critical',
      description: 'desc',
    });
    expect(r.isNew).toBe(false);
    expect(r.updated).toBe(false);
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.create).not.toHaveBeenCalled();
  });

  it('JSON.stringify применяется к oneCValue/cvValue', async () => {
    spies.findFirst.mockResolvedValueOnce(null);
    spies.create.mockResolvedValueOnce({ id: 'd1' });
    await detector._upsertDiscrepancy({
      type: 'no_show_in_cv',
      orderNumber: 'ЗН-001',
      description: 'desc',
      oneCValue: { state: 'Закрыт' },
      cvValue: null,
    });
    const arg = spies.create.mock.calls[0][0].data;
    expect(typeof arg.oneCValue).toBe('string');
    expect(JSON.parse(arg.oneCValue)).toEqual({ state: 'Закрыт' });
    expect(arg.cvValue).toBeNull();
  });
});
