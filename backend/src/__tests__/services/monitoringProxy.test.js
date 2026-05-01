import { describe, it, expect } from 'vitest';

// Тесты для чистых helper-функций monitoringProxy.js.
// Реплицируем функции вручную (не импортируем сервис целиком, чтобы не поднимать
// БД/таймеры/Socket.IO), и проверяем ключевые ветки логики.

// ── Реплики из monitoringProxy.js ──

function extractPostNumber(zoneName) {
  const m = zoneName.match(/^Пост\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

function extractFreeZoneNumber(zoneName) {
  const m = zoneName.match(/^Свободная зона\s+(\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

function mapStatus(ext) {
  if (ext.status === 'free') return 'free';
  if (ext.worksInProgress) return 'active_work';
  return 'occupied';
}

function postStatus(row) {
  if (row.status === 'free') return 'free';
  if (row.worksInProgress) return 'active_work';
  return 'occupied';
}

function zoneStatus(row) {
  return row.status === 'free' ? 'free' : 'occupied';
}

function dedupKey(item) {
  return JSON.stringify({
    s: item.status,
    p: item.plate,
    w: item.works,
    pc: item.peopleCount,
    op: item.openParts,
    c: item.confidence,
  });
}

// dropEmptyDuplicates — фильтрует "Пост 04" если есть "Пост 04 — легковое".
function dropEmptyDuplicates(rawState) {
  if (!Array.isArray(rawState)) return rawState;
  const hasSuffixed = new Map();
  const isSuffixed = (zone) => /—/.test(zone || '');
  const groupKey = (zone) => {
    const p = extractPostNumber(zone);
    if (p) return `post:${p}`;
    const z = extractFreeZoneNumber(zone);
    if (z) return `zone:${z}`;
    return null;
  };
  for (const item of rawState) {
    const key = groupKey(item.zone);
    if (key && isSuffixed(item.zone)) hasSuffixed.set(key, true);
  }
  return rawState.filter(item => {
    const key = groupKey(item.zone);
    if (!key) return true;
    if (!isSuffixed(item.zone) && hasSuffixed.get(key)) return false;
    return true;
  });
}

describe('monitoringProxy - extractPostNumber', () => {
  it('parses two-digit post number', () => {
    expect(extractPostNumber('Пост 01 — легковое')).toBe(1);
    expect(extractPostNumber('Пост 09 — спецтехника')).toBe(9);
    expect(extractPostNumber('Пост 10 — спецтехника')).toBe(10);
  });

  it('parses bare post name without suffix', () => {
    expect(extractPostNumber('Пост 03')).toBe(3);
  });

  it('returns null for non-matching strings', () => {
    expect(extractPostNumber('Свободная зона 01')).toBeNull();
    expect(extractPostNumber('Зона 01')).toBeNull();
    expect(extractPostNumber('')).toBeNull();
    expect(extractPostNumber('Post 01')).toBeNull();
  });

  it('requires exactly two digits', () => {
    // Single digit not zero-padded — regex \d{2} requires two
    expect(extractPostNumber('Пост 1')).toBeNull();
  });
});

describe('monitoringProxy - extractFreeZoneNumber', () => {
  it('parses zone number from external name', () => {
    expect(extractFreeZoneNumber('Свободная зона 01 — оклейка')).toBe(1);
    expect(extractFreeZoneNumber('Свободная зона 07 — мойка')).toBe(7);
  });

  it('returns null for posts and other prefixes', () => {
    expect(extractFreeZoneNumber('Пост 01 — легковое')).toBeNull();
    expect(extractFreeZoneNumber('Зона 01')).toBeNull();
    expect(extractFreeZoneNumber('')).toBeNull();
  });
});

describe('monitoringProxy - mapStatus', () => {
  it('returns free for explicit free status', () => {
    expect(mapStatus({ status: 'free' })).toBe('free');
    // even if works flag set (нелогично, но логика приоритезирует status)
    expect(mapStatus({ status: 'free', worksInProgress: true })).toBe('free');
  });

  it('returns active_work when occupied with works in progress', () => {
    expect(mapStatus({ status: 'occupied', worksInProgress: true })).toBe('active_work');
  });

  it('returns occupied when not free and no works', () => {
    expect(mapStatus({ status: 'occupied', worksInProgress: false })).toBe('occupied');
    expect(mapStatus({ status: 'occupied' })).toBe('occupied');
  });

  it('treats unknown statuses as occupied if no works', () => {
    expect(mapStatus({ status: 'unknown' })).toBe('occupied');
  });
});

describe('monitoringProxy - postStatus / zoneStatus (refreshCacheFromDb)', () => {
  it('postStatus distinguishes free / active_work / occupied', () => {
    expect(postStatus({ status: 'free', worksInProgress: false })).toBe('free');
    expect(postStatus({ status: 'occupied', worksInProgress: true })).toBe('active_work');
    expect(postStatus({ status: 'occupied', worksInProgress: false })).toBe('occupied');
  });

  it('zoneStatus collapses to two states (free/occupied)', () => {
    expect(zoneStatus({ status: 'free', worksInProgress: false })).toBe('free');
    // зоны не различают active_work — всё, что не free, является occupied
    expect(zoneStatus({ status: 'occupied', worksInProgress: true })).toBe('occupied');
    expect(zoneStatus({ status: 'occupied', worksInProgress: false })).toBe('occupied');
  });
});

describe('monitoringProxy - dedupKey (persistToDb)', () => {
  const base = {
    status: 'occupied', plate: 'AA1234', works: false,
    peopleCount: 0, openParts: null, confidence: 0.9,
  };

  it('returns identical key when значимые поля не меняются', () => {
    const a = dedupKey(base);
    const b = dedupKey({ ...base });
    expect(a).toBe(b);
  });

  it('changes when status changes', () => {
    expect(dedupKey({ ...base, status: 'free' })).not.toBe(dedupKey(base));
  });

  it('changes when plate changes', () => {
    expect(dedupKey({ ...base, plate: 'BB5678' })).not.toBe(dedupKey(base));
    expect(dedupKey({ ...base, plate: null })).not.toBe(dedupKey(base));
  });

  it('changes when works flag flips', () => {
    expect(dedupKey({ ...base, works: true })).not.toBe(dedupKey(base));
  });

  it('changes when peopleCount changes', () => {
    expect(dedupKey({ ...base, peopleCount: 1 })).not.toBe(dedupKey(base));
  });

  it('changes when openParts changes', () => {
    expect(dedupKey({ ...base, openParts: '["hood"]' })).not.toBe(dedupKey(base));
  });

  it('changes when confidence changes', () => {
    expect(dedupKey({ ...base, confidence: 0.5 })).not.toBe(dedupKey(base));
  });
});

describe('monitoringProxy - dropEmptyDuplicates', () => {
  it('drops bare post variant when suffixed sibling exists', () => {
    const raw = [
      { zone: 'Пост 04' },
      { zone: 'Пост 04 — легковое' },
    ];
    const out = dropEmptyDuplicates(raw);
    expect(out).toHaveLength(1);
    expect(out[0].zone).toBe('Пост 04 — легковое');
  });

  it('keeps bare post when no suffixed sibling', () => {
    const raw = [{ zone: 'Пост 04' }];
    const out = dropEmptyDuplicates(raw);
    expect(out).toHaveLength(1);
    expect(out[0].zone).toBe('Пост 04');
  });

  it('drops bare zone variant when suffixed sibling exists', () => {
    const raw = [
      { zone: 'Свободная зона 02' },
      { zone: 'Свободная зона 02 — мойка' },
    ];
    const out = dropEmptyDuplicates(raw);
    expect(out).toHaveLength(1);
    expect(out[0].zone).toBe('Свободная зона 02 — мойка');
  });

  it('keeps non-classifiable entries untouched', () => {
    const raw = [
      { zone: 'Свободная зона 02' },
      { zone: 'Свободная зона 02 — мойка' },
      { zone: 'Какая-то другая' },
    ];
    const out = dropEmptyDuplicates(raw);
    expect(out).toHaveLength(2);
    expect(out.find(r => r.zone === 'Какая-то другая')).toBeTruthy();
  });

  it('returns input as-is when not an array', () => {
    expect(dropEmptyDuplicates(null)).toBeNull();
    expect(dropEmptyDuplicates(undefined)).toBeUndefined();
  });

  it('handles independent groups (post + zone) without cross-talk', () => {
    const raw = [
      { zone: 'Пост 01' },                     // bare, has suffixed sibling → drop
      { zone: 'Пост 01 — легковое' },          // keep
      { zone: 'Свободная зона 01' },           // bare, NO suffixed sibling → keep
    ];
    const out = dropEmptyDuplicates(raw);
    const zones = out.map(r => r.zone).sort();
    expect(zones).toEqual(['Пост 01 — легковое', 'Свободная зона 01']);
  });
});
