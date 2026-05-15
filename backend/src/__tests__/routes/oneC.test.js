import { describe, it, expect } from 'vitest';

// Logic-mirror tests for /api/oneC route. Tests cover pure helpers
// and the JS-side filtering used in the route handlers.

const MASK = '****';

function pickPublicConfig(cfg) {
  if (!cfg) return null;
  const { passwordEncrypted, ...rest } = cfg;
  return { ...rest, passwordSet: !!passwordEncrypted, password: MASK };
}

function parseInteger(v, def, max = 1000) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) return def;
  return Math.min(n, max);
}

function filterCurrent(rows, { state, plate, search } = {}) {
  let filtered = rows;
  if (state) filtered = filtered.filter((r) => r.state === String(state));
  if (plate) {
    const p = String(plate).toUpperCase();
    filtered = filtered.filter((r) => (r.plate_number || '').toUpperCase().includes(p));
  }
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((r) =>
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.vin || '').toLowerCase().includes(q) ||
      (r.plate_number || '').toLowerCase().includes(q) ||
      (r.executor || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

describe('oneC route — pickPublicConfig()', () => {
  it('returns null for null input', () => {
    expect(pickPublicConfig(null)).toBeNull();
  });
  it('masks password and returns passwordSet=true when encrypted exists', () => {
    const cfg = { id: 1, host: 'mail', port: 993, passwordEncrypted: 'aes-blob' };
    const pub = pickPublicConfig(cfg);
    expect(pub.password).toBe(MASK);
    expect(pub.passwordSet).toBe(true);
    expect(pub.passwordEncrypted).toBeUndefined();
    expect(pub.host).toBe('mail');
  });
  it('passwordSet=false when no encrypted password', () => {
    const pub = pickPublicConfig({ id: 1, host: 'h' });
    expect(pub.passwordSet).toBe(false);
    expect(pub.password).toBe(MASK);
  });
});

describe('oneC route — parseInteger()', () => {
  it('returns default for NaN', () => {
    expect(parseInteger('abc', 50)).toBe(50);
    expect(parseInteger(undefined, 50)).toBe(50);
  });
  it('returns default for negative', () => {
    expect(parseInteger('-5', 50)).toBe(50);
  });
  it('caps at max', () => {
    expect(parseInteger('99999', 50, 500)).toBe(500);
  });
  it('parses numeric string', () => {
    expect(parseInteger('42', 50, 500)).toBe(42);
  });
  it('accepts 0', () => {
    expect(parseInteger('0', 50)).toBe(0);
  });
});

describe('oneC route — filterCurrent()', () => {
  const rows = [
    { order_number: 'WO-100', state: 'open', plate_number: 'A100AA', vin: 'V100', executor: 'Ivan' },
    { order_number: 'WO-200', state: 'closed', plate_number: 'B200BB', vin: 'V200', executor: 'Pavel' },
    { order_number: 'WO-300', state: 'open', plate_number: 'A300CC', vin: 'V300', executor: 'Sergey' },
  ];

  it('returns all rows without filters', () => {
    expect(filterCurrent(rows)).toHaveLength(3);
  });
  it('filters by state', () => {
    const r = filterCurrent(rows, { state: 'closed' });
    expect(r).toHaveLength(1);
    expect(r[0].order_number).toBe('WO-200');
  });
  it('filters by plate substring (case-insensitive)', () => {
    const r = filterCurrent(rows, { plate: 'a100' });
    expect(r).toHaveLength(1);
    expect(r[0].order_number).toBe('WO-100');
  });
  it('filters by search across multiple fields', () => {
    expect(filterCurrent(rows, { search: 'wo-300' })).toHaveLength(1);
    expect(filterCurrent(rows, { search: 'v200' })).toHaveLength(1);
    expect(filterCurrent(rows, { search: 'ivan' })).toHaveLength(1);
    expect(filterCurrent(rows, { search: 'a100aa' })).toHaveLength(1);
  });
  it('combines filters (state + search)', () => {
    const r = filterCurrent(rows, { state: 'open', search: 'sergey' });
    expect(r).toHaveLength(1);
    expect(r[0].order_number).toBe('WO-300');
  });
  it('returns empty array on no match', () => {
    expect(filterCurrent(rows, { state: 'archived' })).toHaveLength(0);
  });
});

describe('oneC route — upload validation', () => {
  function validateUploadBody(body = {}) {
    const { filename, data, forceType } = body;
    if (!filename || !data) return { ok: false, error: 'filename and data (base64) required', status: 400 };
    if (forceType && !['plan', 'repair', 'performed'].includes(forceType)) {
      return { ok: false, error: 'forceType must be plan|repair|performed', status: 400 };
    }
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return { ok: false, error: 'empty buffer', status: 400 };
    return { ok: true, buffer };
  }

  it('rejects missing filename or data', () => {
    expect(validateUploadBody({}).status).toBe(400);
    expect(validateUploadBody({ filename: 'x.xlsx' }).status).toBe(400);
    expect(validateUploadBody({ data: 'AA==' }).status).toBe(400);
  });
  it('rejects invalid forceType', () => {
    const r = validateUploadBody({ filename: 'f.xlsx', data: 'AAAA', forceType: 'unknown' });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/forceType/);
  });
  it('accepts valid forceTypes', () => {
    for (const ft of ['plan', 'repair', 'performed']) {
      const r = validateUploadBody({ filename: 'f.xlsx', data: 'AAAA', forceType: ft });
      expect(r.ok).toBe(true);
    }
  });
  it('rejects empty buffer', () => {
    const r = validateUploadBody({ filename: 'f.xlsx', data: '' });
    expect(r.status).toBe(400);
  });
  it('accepts valid base64 payload', () => {
    const r = validateUploadBody({ filename: 'f.xlsx', data: Buffer.from('hello').toString('base64') });
    expect(r.ok).toBe(true);
    expect(r.buffer.toString()).toBe('hello');
  });
});

describe('oneC route — acknowledge state guard', () => {
  function canAcknowledge(imp) {
    if (!imp) return { ok: false, status: 404 };
    if (!String(imp.status || '').startsWith('error')) {
      return { ok: false, status: 400, error: 'Acknowledge is allowed only for error imports' };
    }
    return { ok: true };
  }
  it('404 when import not found', () => {
    expect(canAcknowledge(null).status).toBe(404);
  });
  it('400 when status is not error*', () => {
    expect(canAcknowledge({ status: 'done' }).status).toBe(400);
    expect(canAcknowledge({ status: 'pending' }).status).toBe(400);
  });
  it('allows for any error.* status', () => {
    expect(canAcknowledge({ status: 'error' }).ok).toBe(true);
    expect(canAcknowledge({ status: 'error_parse' }).ok).toBe(true);
    expect(canAcknowledge({ status: 'error_db' }).ok).toBe(true);
  });
});

describe('oneC route — password update behavior', () => {
  // Mirrors the logic in PUT /api/oneC/config
  function shouldUpdatePassword(payloadPassword) {
    if (payloadPassword === undefined) return false;
    if (payloadPassword === '' || payloadPassword === MASK) return false;
    return true;
  }
  it('skips update if password missing or empty or masked', () => {
    expect(shouldUpdatePassword(undefined)).toBe(false);
    expect(shouldUpdatePassword('')).toBe(false);
    expect(shouldUpdatePassword(MASK)).toBe(false);
  });
  it('updates password on real new value', () => {
    expect(shouldUpdatePassword('s3cret')).toBe(true);
  });
});
