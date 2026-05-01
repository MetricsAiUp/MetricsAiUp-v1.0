import { describe, it, expect } from 'vitest';

// Тесты для чистых helper-функций /api/replay (replay.js).

function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeJsonArray(s) {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function snapshotToRaw(s) {
  return {
    zone: s.zoneName,
    externalType: s.externalType,
    timestamp: s.timestamp.toISOString(),
    status: s.status,
    worksInProgress: !!s.worksInProgress,
    worksDescription: s.worksDescription,
    peopleCount: s.peopleCount || 0,
    openParts: safeJsonArray(s.openParts),
    confidence: s.confidence,
    car: {
      plate: s.plateNumber,
      color: s.carColor,
      model: s.carModel,
      make: s.carMake,
      body: s.carBody,
      firstSeen: s.carFirstSeen ? s.carFirstSeen.toISOString() : null,
    },
  };
}

// Реплика валидации окна.
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function validateWindow(from, to) {
  if (!from || !to) return { valid: false, error: 'from and to (ISO timestamps) required' };
  if (to <= from) return { valid: false, error: 'to must be greater than from' };
  if (to - from > MAX_WINDOW_MS) return { valid: false, error: `window too large (max ${MAX_WINDOW_MS / 3600000}h)` };
  return { valid: true };
}

describe('replay - parseIso', () => {
  it('parses valid ISO string', () => {
    const d = parseIso('2026-05-01T10:00:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe('2026-05-01T10:00:00.000Z');
  });

  it('returns null for falsy values', () => {
    expect(parseIso(null)).toBeNull();
    expect(parseIso(undefined)).toBeNull();
    expect(parseIso('')).toBeNull();
    expect(parseIso(0)).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(parseIso('not a date')).toBeNull();
    expect(parseIso('2026-13-99')).toBeNull();
  });
});

describe('replay - safeJsonArray', () => {
  it('parses valid JSON array', () => {
    expect(safeJsonArray('["hood","door"]')).toEqual(['hood', 'door']);
  });

  it('returns [] for null/empty', () => {
    expect(safeJsonArray(null)).toEqual([]);
    expect(safeJsonArray('')).toEqual([]);
    expect(safeJsonArray(undefined)).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    expect(safeJsonArray('{"a":1}')).toEqual([]);
    expect(safeJsonArray('"string"')).toEqual([]);
    expect(safeJsonArray('42')).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(safeJsonArray('not json')).toEqual([]);
    expect(safeJsonArray('{')).toEqual([]);
  });
});

describe('replay - snapshotToRaw', () => {
  const baseSnapshot = {
    zoneName: 'Пост 01 — легковое',
    externalType: 'post',
    timestamp: new Date('2026-05-01T10:00:00Z'),
    status: 'occupied',
    worksInProgress: true,
    worksDescription: 'Замена масла',
    peopleCount: 2,
    openParts: '["hood"]',
    confidence: 0.95,
    plateNumber: 'AA1234',
    carColor: 'red',
    carModel: 'Camry',
    carMake: 'Toyota',
    carBody: 'sedan',
    carFirstSeen: new Date('2026-05-01T09:00:00Z'),
  };

  it('maps DB row to raw shape with full car info', () => {
    const raw = snapshotToRaw(baseSnapshot);
    expect(raw.zone).toBe('Пост 01 — легковое');
    expect(raw.timestamp).toBe('2026-05-01T10:00:00.000Z');
    expect(raw.status).toBe('occupied');
    expect(raw.worksInProgress).toBe(true);
    expect(raw.peopleCount).toBe(2);
    expect(raw.openParts).toEqual(['hood']);
    expect(raw.car).toEqual({
      plate: 'AA1234',
      color: 'red',
      model: 'Camry',
      make: 'Toyota',
      body: 'sedan',
      firstSeen: '2026-05-01T09:00:00.000Z',
    });
  });

  it('handles null carFirstSeen', () => {
    const raw = snapshotToRaw({ ...baseSnapshot, carFirstSeen: null });
    expect(raw.car.firstSeen).toBeNull();
  });

  it('coerces worksInProgress to boolean', () => {
    expect(snapshotToRaw({ ...baseSnapshot, worksInProgress: 0 }).worksInProgress).toBe(false);
    expect(snapshotToRaw({ ...baseSnapshot, worksInProgress: 1 }).worksInProgress).toBe(true);
  });

  it('defaults peopleCount to 0 when missing', () => {
    expect(snapshotToRaw({ ...baseSnapshot, peopleCount: null }).peopleCount).toBe(0);
    expect(snapshotToRaw({ ...baseSnapshot, peopleCount: undefined }).peopleCount).toBe(0);
  });

  it('handles invalid openParts JSON gracefully', () => {
    expect(snapshotToRaw({ ...baseSnapshot, openParts: 'broken' }).openParts).toEqual([]);
    expect(snapshotToRaw({ ...baseSnapshot, openParts: null }).openParts).toEqual([]);
  });
});

describe('replay - validateWindow', () => {
  const t = (s) => new Date(s);

  it('rejects missing from/to', () => {
    expect(validateWindow(null, t('2026-05-01T10:00Z')).valid).toBe(false);
    expect(validateWindow(t('2026-05-01T10:00Z'), null).valid).toBe(false);
  });

  it('rejects to <= from', () => {
    const a = t('2026-05-01T10:00Z'), b = t('2026-05-01T09:00Z');
    expect(validateWindow(a, b).valid).toBe(false);
    expect(validateWindow(a, a).valid).toBe(false);
  });

  it('rejects window > 7 days', () => {
    const a = t('2026-05-01T00:00Z');
    const b = new Date(a.getTime() + 8 * 24 * 3600 * 1000);
    const res = validateWindow(a, b);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('168h');
  });

  it('accepts exactly 7 days', () => {
    const a = t('2026-05-01T00:00Z');
    const b = new Date(a.getTime() + 7 * 24 * 3600 * 1000);
    expect(validateWindow(a, b).valid).toBe(true);
  });

  it('accepts small windows', () => {
    const a = t('2026-05-01T08:00Z'), b = t('2026-05-01T20:00Z');
    expect(validateWindow(a, b).valid).toBe(true);
  });
});
