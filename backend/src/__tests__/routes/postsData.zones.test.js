import { describe, it, expect } from 'vitest';

// Тесты для нового кода в /api/dashboard-posts:
// - агрегация snapshot-ов в визиты,
// - дискриминатор kind: 'post' | 'zone',
// - регэксп фильтрации нумерованных зон,
// - no_data fallback для постов без monitoring.

// ── Реплика логики агрегации визитов из /api/dashboard-posts ──
function buildVisitsTimeline(history, shiftStart, shiftEnd) {
  const inShift = (history || []).filter(h => {
    const ts = new Date(h.timestamp).getTime();
    return ts >= shiftStart && ts <= shiftEnd;
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const timeline = [];
  let visit = null;
  for (const h of inShift) {
    if (h.status !== 'free') {
      if (!visit) {
        visit = {
          start: h.timestamp,
          end: h.timestamp,
          plate: h.car?.plate || null,
          brand: h.car?.make || null,
          model: h.car?.model || null,
          worksInProgress: !!h.worksInProgress,
          worksDescription: h.worksDescription || null,
          peopleCount: h.peopleCount || 0,
          confidence: h.confidence,
        };
      } else {
        visit.end = h.timestamp;
        visit.worksInProgress = visit.worksInProgress || !!h.worksInProgress;
        visit.peopleCount = Math.max(visit.peopleCount, h.peopleCount || 0);
        if (h.worksDescription) visit.worksDescription = h.worksDescription;
      }
    } else if (visit) {
      timeline.push({ ...visit, endTime: h.timestamp, completed: true });
      visit = null;
    }
  }
  if (visit) timeline.push({ ...visit, endTime: null, completed: false });
  return timeline;
}

// Реплика маппинга визитов в timeline-блоки.
function visitsToBlocks(timeline, idPrefix) {
  return timeline.map((v, idx) => ({
    id: `${idPrefix}-${idx}`,
    workOrderNumber: null,
    workOrderId: null,
    plateNumber: v.plate,
    brand: v.brand,
    model: v.model,
    workType: v.worksInProgress ? 'monitoring' : null,
    status: v.worksInProgress ? 'in_progress' : 'scheduled',
    startTime: v.start,
    endTime: v.endTime,
    visitClosed: v.completed,
    hadWork: v.worksInProgress,
  }));
}

// Реплика регэкспа из postsData.js — отбирает только "Зона N".
function isNumberedZone(name) {
  const m = name?.match(/^Зона\s+(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

const SHIFT_START = new Date('2026-05-01T05:00:00Z').getTime(); // 08:00 МСК
const SHIFT_END = new Date('2026-05-01T19:00:00Z').getTime();   // 22:00 МСК

describe('dashboard-posts - visit aggregation', () => {
  it('returns empty timeline for empty history', () => {
    expect(buildVisitsTimeline([], SHIFT_START, SHIFT_END)).toEqual([]);
  });

  it('opens visit on first non-free entry', () => {
    const hist = [
      { timestamp: '2026-05-01T08:30:00Z', status: 'occupied', car: { plate: 'AA1234' } },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].plate).toBe('AA1234');
    expect(tl[0].endTime).toBeNull();
    expect(tl[0].completed).toBe(false);
  });

  it('closes visit on first free entry', () => {
    const hist = [
      { timestamp: '2026-05-01T08:30:00Z', status: 'occupied', car: { plate: 'AA1234' } },
      { timestamp: '2026-05-01T09:00:00Z', status: 'occupied' },
      { timestamp: '2026-05-01T09:15:00Z', status: 'free' },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].completed).toBe(true);
    expect(tl[0].endTime).toBe('2026-05-01T09:15:00Z');
  });

  it('produces multiple visits separated by free intervals', () => {
    const hist = [
      { timestamp: '2026-05-01T08:00:00Z', status: 'occupied', car: { plate: 'AA1' } },
      { timestamp: '2026-05-01T08:30:00Z', status: 'free' },
      { timestamp: '2026-05-01T10:00:00Z', status: 'occupied', car: { plate: 'BB2' } },
      { timestamp: '2026-05-01T11:00:00Z', status: 'free' },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(2);
    expect(tl[0].plate).toBe('AA1');
    expect(tl[0].completed).toBe(true);
    expect(tl[1].plate).toBe('BB2');
    expect(tl[1].completed).toBe(true);
  });

  it('promotes worksInProgress=true if any snapshot in visit had work', () => {
    const hist = [
      { timestamp: '2026-05-01T08:00:00Z', status: 'occupied', worksInProgress: false },
      { timestamp: '2026-05-01T08:10:00Z', status: 'occupied', worksInProgress: true, worksDescription: 'Замена масла' },
      { timestamp: '2026-05-01T08:20:00Z', status: 'occupied', worksInProgress: false },
      { timestamp: '2026-05-01T08:30:00Z', status: 'free' },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].worksInProgress).toBe(true);
    expect(tl[0].worksDescription).toBe('Замена масла');
  });

  it('takes max peopleCount across visit', () => {
    const hist = [
      { timestamp: '2026-05-01T08:00:00Z', status: 'occupied', peopleCount: 1 },
      { timestamp: '2026-05-01T08:10:00Z', status: 'occupied', peopleCount: 3 },
      { timestamp: '2026-05-01T08:20:00Z', status: 'occupied', peopleCount: 2 },
      { timestamp: '2026-05-01T08:30:00Z', status: 'free' },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl[0].peopleCount).toBe(3);
  });

  it('filters out entries outside shift bounds', () => {
    const hist = [
      { timestamp: '2026-05-01T03:00:00Z', status: 'occupied', car: { plate: 'OUT1' } }, // до смены
      { timestamp: '2026-05-01T08:00:00Z', status: 'occupied', car: { plate: 'IN1' } },
      { timestamp: '2026-05-01T08:30:00Z', status: 'free' },
      { timestamp: '2026-05-01T22:00:00Z', status: 'occupied', car: { plate: 'OUT2' } }, // после смены
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].plate).toBe('IN1');
  });

  it('keeps last visit open if shift ends mid-visit (no closing free)', () => {
    const hist = [
      { timestamp: '2026-05-01T18:00:00Z', status: 'occupied', car: { plate: 'STILL_HERE' } },
      { timestamp: '2026-05-01T18:30:00Z', status: 'occupied' },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].completed).toBe(false);
    expect(tl[0].endTime).toBeNull();
  });

  it('sorts unsorted history before aggregating', () => {
    const hist = [
      { timestamp: '2026-05-01T09:00:00Z', status: 'free' },
      { timestamp: '2026-05-01T08:00:00Z', status: 'occupied', car: { plate: 'A1' } },
    ];
    const tl = buildVisitsTimeline(hist, SHIFT_START, SHIFT_END);
    expect(tl).toHaveLength(1);
    expect(tl[0].completed).toBe(true);
    expect(tl[0].start).toBe('2026-05-01T08:00:00Z');
  });
});

describe('dashboard-posts - visitsToBlocks (status mapping)', () => {
  it('maps visit with works to in_progress', () => {
    const tl = [{ start: 't1', end: 't2', endTime: null, plate: 'A1', worksInProgress: true, completed: false, peopleCount: 1 }];
    const blocks = visitsToBlocks(tl, 'mon-1');
    expect(blocks[0].status).toBe('in_progress');
    expect(blocks[0].workType).toBe('monitoring');
    expect(blocks[0].hadWork).toBe(true);
  });

  it('maps visit without works to scheduled', () => {
    const tl = [{ start: 't1', end: 't2', endTime: 't2', plate: 'A1', worksInProgress: false, completed: true, peopleCount: 0 }];
    const blocks = visitsToBlocks(tl, 'mon-1');
    expect(blocks[0].status).toBe('scheduled');
    expect(blocks[0].workType).toBeNull();
    expect(blocks[0].visitClosed).toBe(true);
  });

  it('uses prefix in block id', () => {
    const tl = [
      { start: 't1', endTime: null, completed: false, worksInProgress: false, peopleCount: 0 },
      { start: 't3', endTime: null, completed: false, worksInProgress: false, peopleCount: 0 },
    ];
    const postBlocks = visitsToBlocks(tl, 'mon-5');
    const zoneBlocks = visitsToBlocks(tl, 'mon-zone-3');
    expect(postBlocks[0].id).toBe('mon-5-0');
    expect(postBlocks[1].id).toBe('mon-5-1');
    expect(zoneBlocks[0].id).toBe('mon-zone-3-0');
  });
});

describe('dashboard-posts - isNumberedZone filter', () => {
  it('matches "Зона N" exactly', () => {
    expect(isNumberedZone('Зона 1')).toBe(1);
    expect(isNumberedZone('Зона 7')).toBe(7);
    expect(isNumberedZone('Зона 12')).toBe(12);
  });

  it('rejects compound names', () => {
    expect(isNumberedZone('Ремонтная зона 1-4')).toBeNull();
    expect(isNumberedZone('Зона ожидания')).toBeNull();
    expect(isNumberedZone('Свободная зона 01')).toBeNull();
    expect(isNumberedZone('Зона 1A')).toBeNull();
  });

  it('rejects empty/null input', () => {
    expect(isNumberedZone('')).toBeNull();
    expect(isNumberedZone(null)).toBeNull();
    expect(isNumberedZone(undefined)).toBeNull();
  });

  it('requires exact "Зона N" — not "Зоны" or trailing junk', () => {
    expect(isNumberedZone('Зона 1 ')).toBeNull(); // trailing space
    expect(isNumberedZone('Зоны 1')).toBeNull();
  });
});

describe('dashboard-posts - kind discriminator and no_data fallback', () => {
  // Реплика fallback-логики: посты в БД, отсутствующие в monitoring → status='no_data'.
  function appendNoDataPosts(monPosts, postsMap) {
    const seen = new Set(monPosts.map(p => p.number));
    const out = [...monPosts];
    for (const [num, dbPost] of postsMap) {
      if (seen.has(num)) continue;
      out.push({
        id: `post-${num}`,
        number: num,
        name: dbPost.name,
        kind: 'post',
        status: 'no_data',
        timeline: [],
      });
    }
    out.forEach(p => { if (!p.kind) p.kind = 'post'; });
    return out.sort((a, b) => a.number - b.number);
  }

  it('marks DB-only posts as status=no_data', () => {
    const monPosts = [
      { id: 'post-1', number: 1, status: 'free', timeline: [] },
    ];
    const map = new Map([
      [1, { name: 'Пост 1' }],
      [11, { name: 'Пост 11' }], // нет в monitoring
    ]);
    const result = appendNoDataPosts(monPosts, map);
    expect(result).toHaveLength(2);
    const p11 = result.find(p => p.number === 11);
    expect(p11.status).toBe('no_data');
    expect(p11.kind).toBe('post');
    expect(p11.timeline).toEqual([]);
  });

  it('does not duplicate posts already in monitoring', () => {
    const monPosts = [{ id: 'post-1', number: 1, status: 'free', timeline: [] }];
    const map = new Map([[1, { name: 'Пост 1' }]]);
    const result = appendNoDataPosts(monPosts, map);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('free');
  });

  it('sorts posts by number after merge', () => {
    const monPosts = [
      { id: 'post-5', number: 5, status: 'free', timeline: [] },
      { id: 'post-1', number: 1, status: 'free', timeline: [] },
    ];
    const map = new Map([
      [1, { name: 'Пост 1' }],
      [5, { name: 'Пост 5' }],
      [11, { name: 'Пост 11' }],
    ]);
    const nums = appendNoDataPosts(monPosts, map).map(p => p.number);
    expect(nums).toEqual([1, 5, 11]);
  });

  it('assigns kind=post even when not explicitly set on monitoring rows', () => {
    const monPosts = [{ id: 'post-1', number: 1, status: 'free', timeline: [] }];
    const map = new Map();
    const result = appendNoDataPosts(monPosts, map);
    expect(result[0].kind).toBe('post');
  });
});

describe('dashboard-posts - zone rows kind="zone" + no_data fallback', () => {
  // Реплика построения zoneRows + добор зон из БД.
  function buildZoneRows(monZones, dbZones) {
    const rows = monZones.map(mz => ({
      id: `zone-${mz.zoneNumber}`,
      number: mz.zoneNumber,
      name: `Зона ${String(mz.zoneNumber).padStart(2, '0')}`,
      type: 'free',
      kind: 'zone',
      status: mz.status,
      timeline: [],
    }));
    const seen = new Set(rows.map(r => r.number));
    for (const z of dbZones) {
      const num = isNumberedZone(z.name);
      if (!num || seen.has(num)) continue;
      rows.push({
        id: `zone-${num}`,
        number: num,
        name: z.displayName || `Зона ${String(num).padStart(2, '0')}`,
        type: z.type || 'free',
        kind: 'zone',
        status: 'no_data',
        timeline: [],
      });
    }
    return rows.sort((a, b) => a.number - b.number);
  }

  it('all rows have kind="zone"', () => {
    const monZones = [{ zoneNumber: 1, status: 'free' }];
    const dbZones = [{ name: 'Зона 1' }, { name: 'Зона 2' }];
    const rows = buildZoneRows(monZones, dbZones);
    expect(rows.every(r => r.kind === 'zone')).toBe(true);
  });

  it('adds DB-only zones with status=no_data', () => {
    const monZones = [{ zoneNumber: 1, status: 'free' }];
    const dbZones = [{ name: 'Зона 1' }, { name: 'Зона 7', displayName: 'Седьмая зона' }];
    const rows = buildZoneRows(monZones, dbZones);
    expect(rows).toHaveLength(2);
    const z7 = rows.find(r => r.number === 7);
    expect(z7.status).toBe('no_data');
    expect(z7.name).toBe('Седьмая зона');
  });

  it('skips non-numbered DB zones (e.g. Ремонтная зона)', () => {
    const monZones = [];
    const dbZones = [
      { name: 'Зона 1' },
      { name: 'Ремонтная зона 1-4' },
      { name: 'Зона ожидания' },
      { name: 'Зона 2' },
    ];
    const rows = buildZoneRows(monZones, dbZones);
    expect(rows.map(r => r.number).sort()).toEqual([1, 2]);
  });

  it('does not duplicate zones already in monitoring', () => {
    const monZones = [{ zoneNumber: 3, status: 'occupied' }];
    const dbZones = [{ name: 'Зона 3' }];
    const rows = buildZoneRows(monZones, dbZones);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('occupied'); // monitoring wins
  });

  it('sorts zones by number', () => {
    const monZones = [{ zoneNumber: 5, status: 'free' }];
    const dbZones = [{ name: 'Зона 1' }, { name: 'Зона 3' }];
    const rows = buildZoneRows(monZones, dbZones);
    expect(rows.map(r => r.number)).toEqual([1, 3, 5]);
  });
});
