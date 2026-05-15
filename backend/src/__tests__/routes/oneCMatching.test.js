import { describe, it, expect } from 'vitest';

// Logic-mirror tests for /api/oneC/matching helpers.
// Mirrors the pure logic in routes/oneCMatching.js so we can validate
// the severity/normalisation/grouping rules independently of Prisma.

const DELTA_THRESHOLDS = { green: 15 * 60, yellow: 60 * 60, orange: 4 * 60 * 60 };
const SEVERITY_RANK = { gray: 0, green: 1, yellow: 2, orange: 3, red: 4 };

function severityFromDelta(deltaSec) {
  if (deltaSec == null) return 'gray';
  const a = Math.abs(deltaSec);
  if (a <= DELTA_THRESHOLDS.green) return 'green';
  if (a <= DELTA_THRESHOLDS.yellow) return 'yellow';
  if (a <= DELTA_THRESHOLDS.orange) return 'orange';
  return 'red';
}

function maxSeverity(...sevs) {
  let best = 'gray';
  for (const s of sevs) if (SEVERITY_RANK[s] > SEVERITY_RANK[best]) best = s;
  return best;
}

function diffSec(a, b) {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((da - db) / 1000);
}

function normPlate(p) { return p ? String(p).toUpperCase().replace(/[\s\-]/g, '') : ''; }
function normVin(v) { return v ? String(v).toUpperCase().replace(/\s/g, '') : ''; }

function vehicleMatches(repair, planRows) {
  const rVin = normVin(repair.vin);
  const rPlates = [normPlate(repair.plateNumber1), normPlate(repair.plateNumber2)].filter(Boolean);
  for (const p of planRows) {
    const pVin = normVin(p.vin);
    const pPlate = normPlate(p.plateNumber);
    if (rVin && pVin && rVin !== pVin) return false;
    if (rPlates.length && pPlate && !rPlates.includes(pPlate)) return false;
  }
  return true;
}

function extractPlanNumberFromBasis(basis) {
  if (!basis) return null;
  const m = String(basis).match(/№\s*([\w-]+)/u);
  return m ? m[1] : null;
}

function planSpan(planRows) {
  let s = null, e = null;
  for (const p of planRows) {
    const ps = p.scheduledStart ? new Date(p.scheduledStart).getTime() : null;
    const pe = p.scheduledEnd ? new Date(p.scheduledEnd).getTime() : null;
    if (ps != null && (s == null || ps < s)) s = ps;
    if (pe != null && (e == null || pe > e)) e = pe;
  }
  return {
    planStart: s != null ? new Date(s).toISOString() : null,
    planEnd:   e != null ? new Date(e).toISOString() : null,
  };
}

describe('oneCMatching — severityFromDelta()', () => {
  it('returns gray for null', () => {
    expect(severityFromDelta(null)).toBe('gray');
  });
  it('green within 15 min', () => {
    expect(severityFromDelta(0)).toBe('green');
    expect(severityFromDelta(900)).toBe('green'); // 15m
    expect(severityFromDelta(-900)).toBe('green');
  });
  it('yellow within 1 hour', () => {
    expect(severityFromDelta(901)).toBe('yellow');
    expect(severityFromDelta(3600)).toBe('yellow');
  });
  it('orange within 4 hours', () => {
    expect(severityFromDelta(3601)).toBe('orange');
    expect(severityFromDelta(14400)).toBe('orange');
  });
  it('red beyond 4 hours', () => {
    expect(severityFromDelta(14401)).toBe('red');
    expect(severityFromDelta(-99999)).toBe('red');
  });
});

describe('oneCMatching — maxSeverity()', () => {
  it('returns highest severity', () => {
    expect(maxSeverity('gray', 'green', 'red', 'yellow')).toBe('red');
    expect(maxSeverity('gray', 'green')).toBe('green');
    expect(maxSeverity('orange', 'yellow')).toBe('orange');
  });
  it('returns gray when all gray or empty', () => {
    expect(maxSeverity()).toBe('gray');
    expect(maxSeverity('gray', 'gray')).toBe('gray');
  });
});

describe('oneCMatching — normPlate/normVin', () => {
  it('uppercases and strips spaces/dashes from plate', () => {
    expect(normPlate('a 123-bc')).toBe('A123BC');
    expect(normPlate('')).toBe('');
    expect(normPlate(null)).toBe('');
  });
  it('uppercases and strips spaces from VIN', () => {
    expect(normVin('jt n bk 11')).toBe('JTNBK11');
    expect(normVin(null)).toBe('');
  });
});

describe('oneCMatching — vehicleMatches()', () => {
  it('matches when VIN and plate align', () => {
    const r = { vin: 'JT1234', plateNumber1: 'A123BC', plateNumber2: null };
    const p = [{ vin: 'JT1234', plateNumber: 'A123BC' }];
    expect(vehicleMatches(r, p)).toBe(true);
  });
  it('fails on VIN mismatch', () => {
    const r = { vin: 'JT1234' };
    const p = [{ vin: 'JT9999', plateNumber: null }];
    expect(vehicleMatches(r, p)).toBe(false);
  });
  it('fails on plate not in [plate1, plate2]', () => {
    const r = { plateNumber1: 'A123BC', plateNumber2: 'B456DE' };
    const p = [{ plateNumber: 'X000XX' }];
    expect(vehicleMatches(r, p)).toBe(false);
  });
  it('passes when one of plate1/plate2 matches', () => {
    const r = { plateNumber1: 'A123BC', plateNumber2: 'B456DE' };
    const p = [{ plateNumber: 'B456DE' }];
    expect(vehicleMatches(r, p)).toBe(true);
  });
  it('matches when fields are empty in plan (no constraint)', () => {
    const r = { vin: 'X', plateNumber1: 'A' };
    const p = [{ vin: null, plateNumber: null }];
    expect(vehicleMatches(r, p)).toBe(true);
  });
});

describe('oneCMatching — extractPlanNumberFromBasis()', () => {
  it('parses № N-format from basis text', () => {
    expect(extractPlanNumberFromBasis('Заявка № PL-001 от 14.05.2026')).toBe('PL-001');
  });
  it('returns null when no match', () => {
    expect(extractPlanNumberFromBasis('just a string')).toBeNull();
    expect(extractPlanNumberFromBasis('')).toBeNull();
    expect(extractPlanNumberFromBasis(null)).toBeNull();
  });
});

describe('oneCMatching — planSpan()', () => {
  it('returns nulls for empty input', () => {
    expect(planSpan([])).toEqual({ planStart: null, planEnd: null });
  });
  it('captures min start and max end across rows', () => {
    const rows = [
      { scheduledStart: '2026-04-14T08:00:00Z', scheduledEnd: '2026-04-14T10:00:00Z' },
      { scheduledStart: '2026-04-14T07:00:00Z', scheduledEnd: '2026-04-14T09:00:00Z' },
      { scheduledStart: '2026-04-14T09:30:00Z', scheduledEnd: '2026-04-14T12:00:00Z' },
    ];
    const span = planSpan(rows);
    expect(span.planStart).toBe('2026-04-14T07:00:00.000Z');
    expect(span.planEnd).toBe('2026-04-14T12:00:00.000Z');
  });
  it('ignores rows with missing dates', () => {
    const rows = [
      { scheduledStart: null, scheduledEnd: null },
      { scheduledStart: '2026-04-14T07:00:00Z', scheduledEnd: '2026-04-14T08:00:00Z' },
    ];
    const span = planSpan(rows);
    expect(span.planStart).toBe('2026-04-14T07:00:00.000Z');
  });
});

describe('oneCMatching — version grouping', () => {
  // Mirrors: group repairs by orderNumber, latest first by receivedAt
  function groupVersions(repairs) {
    const map = new Map();
    for (const r of repairs) {
      const key = r.orderNumber || `__noorder_${r.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ta = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const tb = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return tb - ta;
      });
    }
    return map;
  }
  it('groups by orderNumber and sorts latest first', () => {
    const repairs = [
      { id: 1, orderNumber: 'WO-1', receivedAt: '2026-04-10T10:00:00Z' },
      { id: 2, orderNumber: 'WO-1', receivedAt: '2026-04-12T10:00:00Z' },
      { id: 3, orderNumber: 'WO-2', receivedAt: '2026-04-11T10:00:00Z' },
    ];
    const grouped = groupVersions(repairs);
    expect(grouped.get('WO-1')[0].id).toBe(2);
    expect(grouped.get('WO-1')[1].id).toBe(1);
    expect(grouped.get('WO-2')).toHaveLength(1);
  });
  it('falls back to __noorder_<id> when orderNumber missing', () => {
    const grouped = groupVersions([{ id: 99, orderNumber: null }]);
    expect(grouped.has('__noorder_99')).toBe(true);
  });
});

describe('oneCMatching — match status decision', () => {
  function decideMatchStatus(repair, planByDocText) {
    const basis = repair.basis || null;
    if (!basis) return { matchStatus: 'no_basis', planNumber: null };
    const planRows = planByDocText.get(basis) || [];
    if (planRows.length === 0) {
      return { matchStatus: 'basis_not_found', planNumber: extractPlanNumberFromBasis(basis) };
    }
    return {
      matchStatus: vehicleMatches(repair, planRows) ? 'matched' : 'matched_vehicle_mismatch',
      planNumber: planRows[0].number || extractPlanNumberFromBasis(basis),
    };
  }
  it('no_basis when basis is empty', () => {
    expect(decideMatchStatus({ basis: null }, new Map()).matchStatus).toBe('no_basis');
  });
  it('basis_not_found when no plan rows', () => {
    const r = decideMatchStatus({ basis: 'Заявка № P-1' }, new Map());
    expect(r.matchStatus).toBe('basis_not_found');
    expect(r.planNumber).toBe('P-1');
  });
  it('matched when vehicle aligns', () => {
    const map = new Map([['Заявка № P-1', [{ vin: 'V', plateNumber: 'A', number: 'P-1' }]]]);
    const r = decideMatchStatus({ basis: 'Заявка № P-1', vin: 'V', plateNumber1: 'A' }, map);
    expect(r.matchStatus).toBe('matched');
    expect(r.planNumber).toBe('P-1');
  });
  it('matched_vehicle_mismatch when VIN differs', () => {
    const map = new Map([['Заявка № P-1', [{ vin: 'X', plateNumber: null, number: 'P-1' }]]]);
    const r = decideMatchStatus({ basis: 'Заявка № P-1', vin: 'V' }, map);
    expect(r.matchStatus).toBe('matched_vehicle_mismatch');
  });
});

describe('oneCMatching — KPI aggregator', () => {
  function computeKpi(items) {
    const kpi = { total: items.length, matched: 0, noBasis: 0, basisNotFound: 0, vehicleMismatch: 0, severityOrangeOrRed: 0 };
    for (const it of items) {
      if (it.matchStatus === 'matched') kpi.matched++;
      else if (it.matchStatus === 'no_basis') kpi.noBasis++;
      else if (it.matchStatus === 'basis_not_found') kpi.basisNotFound++;
      else if (it.matchStatus === 'matched_vehicle_mismatch') kpi.vehicleMismatch++;
      if (it.severity === 'orange' || it.severity === 'red') kpi.severityOrangeOrRed++;
    }
    return kpi;
  }
  it('aggregates correctly', () => {
    const items = [
      { matchStatus: 'matched', severity: 'green' },
      { matchStatus: 'matched', severity: 'red' },
      { matchStatus: 'no_basis', severity: 'gray' },
      { matchStatus: 'basis_not_found', severity: 'orange' },
      { matchStatus: 'matched_vehicle_mismatch', severity: 'yellow' },
    ];
    const k = computeKpi(items);
    expect(k.total).toBe(5);
    expect(k.matched).toBe(2);
    expect(k.noBasis).toBe(1);
    expect(k.basisNotFound).toBe(1);
    expect(k.vehicleMismatch).toBe(1);
    expect(k.severityOrangeOrRed).toBe(2);
  });
});
