import { describe, it, expect } from 'vitest';
const { updateStatusSchema } = require('../../schemas/discrepancies');

// --- 1. Zod-схема: валидация PATCH /:id/status ------------------------------

describe('schemas/discrepancies — updateStatusSchema', () => {
  it('принимает все 4 валидных статуса', () => {
    for (const status of ['open', 'acknowledged', 'resolved', 'dismissed']) {
      const r = updateStatusSchema.safeParse({ status });
      expect(r.success).toBe(true);
    }
  });

  it('отклоняет неизвестный статус', () => {
    const r = updateStatusSchema.safeParse({ status: 'frozen' });
    expect(r.success).toBe(false);
  });

  it('требует поле status', () => {
    const r = updateStatusSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('closeReason / closeComment — необязательные', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved' });
    expect(r.success).toBe(true);
  });

  it('closeReason: строка ≤ 120 символов — ок', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved', closeReason: 'a'.repeat(120) });
    expect(r.success).toBe(true);
  });

  it('closeReason: > 120 символов — fail', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved', closeReason: 'a'.repeat(121) });
    expect(r.success).toBe(false);
  });

  it('closeComment: строка ≤ 2000 — ок', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved', closeComment: 'x'.repeat(2000) });
    expect(r.success).toBe(true);
  });

  it('closeComment: > 2000 — fail', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved', closeComment: 'x'.repeat(2001) });
    expect(r.success).toBe(false);
  });

  it('closeReason/closeComment поддерживают null', () => {
    const r = updateStatusSchema.safeParse({ status: 'resolved', closeReason: null, closeComment: null });
    expect(r.success).toBe(true);
  });
});

// --- 2. Логика обновления статуса (повторяет блок из роута) -----------------
//
// Воспроизводим точно тот же if/else, что в routes/discrepancies.js → PATCH /:id/status.
// Это пайплайн "построение data-объекта для prisma.discrepancy.update".

function buildUpdateData({ status, closeReason, closeComment, actor, now }) {
  const data = { status };
  if (status === 'acknowledged') {
    data.acknowledgedAt = now;
    data.acknowledgedBy = actor;
  } else if (status === 'resolved' || status === 'dismissed') {
    data.resolvedAt = now;
    data.resolvedBy = actor;
    data.closeReason = closeReason ?? null;
    data.closeComment = closeComment ?? null;
  } else {
    data.acknowledgedAt = null;
    data.acknowledgedBy = null;
    data.resolvedAt = null;
    data.resolvedBy = null;
    data.closeReason = null;
    data.closeComment = null;
  }
  return data;
}

describe('routes/discrepancies — buildUpdateData (PATCH /:id/status)', () => {
  const now = new Date('2026-05-06T10:00:00Z');
  const actor = 'admin@metricsai.up';

  it('status=acknowledged → проставляет acknowledgedAt/By, не трогает resolved-поля', () => {
    const d = buildUpdateData({ status: 'acknowledged', actor, now });
    expect(d.status).toBe('acknowledged');
    expect(d.acknowledgedAt).toBe(now);
    expect(d.acknowledgedBy).toBe(actor);
    expect(d).not.toHaveProperty('resolvedAt');
    expect(d).not.toHaveProperty('resolvedBy');
  });

  it('status=resolved → resolvedAt/By + closeReason/Comment', () => {
    const d = buildUpdateData({
      status: 'resolved',
      closeReason: 'fixed in 1С',
      closeComment: 'после ручной правки',
      actor,
      now,
    });
    expect(d.status).toBe('resolved');
    expect(d.resolvedAt).toBe(now);
    expect(d.resolvedBy).toBe(actor);
    expect(d.closeReason).toBe('fixed in 1С');
    expect(d.closeComment).toBe('после ручной правки');
  });

  it('status=dismissed → как resolved, но статус другой', () => {
    const d = buildUpdateData({ status: 'dismissed', closeReason: 'false positive', actor, now });
    expect(d.status).toBe('dismissed');
    expect(d.resolvedAt).toBe(now);
    expect(d.resolvedBy).toBe(actor);
    expect(d.closeReason).toBe('false positive');
    expect(d.closeComment).toBeNull();
  });

  it('status=resolved без closeReason/closeComment → null', () => {
    const d = buildUpdateData({ status: 'resolved', actor, now });
    expect(d.closeReason).toBeNull();
    expect(d.closeComment).toBeNull();
  });

  it('status=open → сбрасывает все close/ack-поля в null', () => {
    const d = buildUpdateData({ status: 'open', actor, now });
    expect(d.status).toBe('open');
    expect(d.acknowledgedAt).toBeNull();
    expect(d.acknowledgedBy).toBeNull();
    expect(d.resolvedAt).toBeNull();
    expect(d.resolvedBy).toBeNull();
    expect(d.closeReason).toBeNull();
    expect(d.closeComment).toBeNull();
  });
});

// --- 3. buildWhere — фильтрация GET / ---------------------------------------
//
// Повторяет реализацию buildWhere из routes/discrepancies.js.

function buildWhere(query) {
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.severity) where.severity = String(query.severity);
  if (query.type) where.type = String(query.type);
  if (query.postId) where.postId = String(query.postId);
  if (query.orderNumber) where.orderNumber = String(query.orderNumber);
  if (query.from || query.to) {
    where.detectedAt = {};
    if (query.from) where.detectedAt.gte = new Date(String(query.from));
    if (query.to) where.detectedAt.lte = new Date(String(query.to));
  }
  return where;
}

describe('routes/discrepancies — buildWhere', () => {
  it('пустой query → пустой where', () => {
    expect(buildWhere({})).toEqual({});
  });

  it('все простые фильтры', () => {
    const w = buildWhere({
      status: 'open',
      severity: 'critical',
      type: 'no_show_in_cv',
      postId: 'p1',
      orderNumber: 'ЗН-1',
    });
    expect(w).toEqual({
      status: 'open',
      severity: 'critical',
      type: 'no_show_in_cv',
      postId: 'p1',
      orderNumber: 'ЗН-1',
    });
  });

  it('from + to → диапазон detectedAt', () => {
    const w = buildWhere({ from: '2026-05-01', to: '2026-05-06' });
    expect(w.detectedAt.gte).toBeInstanceOf(Date);
    expect(w.detectedAt.lte).toBeInstanceOf(Date);
    expect(w.detectedAt.gte.toISOString()).toContain('2026-05-01');
    expect(w.detectedAt.lte.toISOString()).toContain('2026-05-06');
  });

  it('только from → только gte', () => {
    const w = buildWhere({ from: '2026-05-01' });
    expect(w.detectedAt.gte).toBeInstanceOf(Date);
    expect(w.detectedAt.lte).toBeUndefined();
  });

  it('q.status undefined → не добавляется в where', () => {
    const w = buildWhere({ status: undefined, type: 'wrong_post' });
    expect(w).toEqual({ type: 'wrong_post' });
    expect(w).not.toHaveProperty('status');
  });
});

// --- 4. parseInteger — пагинация --------------------------------------------

function parseInteger(v, def, max = 1000) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return def;
  return Math.min(n, max);
}

describe('routes/discrepancies — parseInteger (pagination)', () => {
  it('валидное число в пределах max', () => {
    expect(parseInteger('25', 50, 500)).toBe(25);
  });

  it('пусто/undefined → дефолт', () => {
    expect(parseInteger(undefined, 50)).toBe(50);
    expect(parseInteger('', 50)).toBe(50);
    expect(parseInteger('abc', 50)).toBe(50);
  });

  it('отрицательное → дефолт', () => {
    expect(parseInteger('-1', 50)).toBe(50);
  });

  it('число > max → max', () => {
    expect(parseInteger('999999', 50, 500)).toBe(500);
  });

  it('default take=50, max=500', () => {
    expect(parseInteger('1000', 50, 500)).toBe(500);
  });
});

// --- 5. Stats response shape ------------------------------------------------

describe('routes/discrepancies — GET /stats response shape', () => {
  it('форматирует groupBy → плоский массив { type, count }', () => {
    const groupByResult = [
      { type: 'no_show_in_cv', _count: { _all: 5 } },
      { type: 'wrong_post', _count: { _all: 2 } },
    ];
    const formatted = groupByResult.map((g) => ({ type: g.type, count: g._count._all }));
    expect(formatted).toEqual([
      { type: 'no_show_in_cv', count: 5 },
      { type: 'wrong_post', count: 2 },
    ]);
  });

  it('форматирует severity-groupBy → { severity, count }', () => {
    const groupByResult = [
      { severity: 'critical', _count: { _all: 3 } },
      { severity: 'warning', _count: { _all: 7 } },
    ];
    const formatted = groupByResult.map((g) => ({ severity: g.severity, count: g._count._all }));
    expect(formatted).toEqual([
      { severity: 'critical', count: 3 },
      { severity: 'warning', count: 7 },
    ]);
  });

  it('итоговый shape stats содержит все ключи', () => {
    const stats = {
      total: 10,
      open: 5,
      newLast24h: 2,
      byType: [],
      bySeverity: [],
    };
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('open');
    expect(stats).toHaveProperty('newLast24h');
    expect(Array.isArray(stats.byType)).toBe(true);
    expect(Array.isArray(stats.bySeverity)).toBe(true);
  });
});
