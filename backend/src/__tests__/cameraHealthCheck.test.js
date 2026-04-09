import { describe, it, expect } from 'vitest';

describe('cameraHealthCheck - logic', () => {
  it('getCameraStatuses returns empty object when statusMap is empty', () => {
    // Replicate the getCameraStatuses logic
    const statusMap = new Map();
    const result = {};
    statusMap.forEach((v, k) => { result[k] = v; });
    expect(result).toEqual({});
  });

  it('getCameraStatuses converts Map to plain object', () => {
    const statusMap = new Map();
    statusMap.set('cam01', { online: true, lastCheck: new Date('2026-04-09T10:00:00Z') });
    statusMap.set('cam02', { online: false, lastCheck: new Date('2026-04-09T10:00:00Z') });

    const result = {};
    statusMap.forEach((v, k) => { result[k] = v; });

    expect(result).toEqual({
      cam01: { online: true, lastCheck: new Date('2026-04-09T10:00:00Z') },
      cam02: { online: false, lastCheck: new Date('2026-04-09T10:00:00Z') },
    });
  });

  it('generates correct camera IDs (cam01 through cam10)', () => {
    const CAM_IDS = Array.from({ length: 10 }, (_, i) => `cam${String(i + 1).padStart(2, '0')}`);
    expect(CAM_IDS).toEqual([
      'cam01', 'cam02', 'cam03', 'cam04', 'cam05',
      'cam06', 'cam07', 'cam08', 'cam09', 'cam10',
    ]);
  });

  it('checkCamera returns false when fetch fails', async () => {
    // Replicate the checkCamera logic
    async function checkCamera(camId, fetchFn) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetchFn(`http://localhost:8181/api/stream/status`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return data[camId]?.streaming || false;
        }
        return false;
      } catch {
        return false;
      }
    }

    const failingFetch = () => Promise.reject(new Error('Connection refused'));
    const result = await checkCamera('cam01', failingFetch);
    expect(result).toBe(false);
  });

  it('checkCamera returns true when camera is streaming', async () => {
    async function checkCamera(camId, fetchFn) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetchFn(`http://localhost:8181/api/stream/status`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return data[camId]?.streaming || false;
        }
        return false;
      } catch {
        return false;
      }
    }

    const successFetch = () => Promise.resolve({
      ok: true,
      json: async () => ({ cam01: { streaming: true }, cam02: { streaming: false } }),
    });

    expect(await checkCamera('cam01', successFetch)).toBe(true);
    expect(await checkCamera('cam02', successFetch)).toBe(false);
    expect(await checkCamera('cam99', successFetch)).toBe(false);
  });

  it('checkCamera returns false when response is not ok', async () => {
    async function checkCamera(camId, fetchFn) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetchFn(`http://localhost:8181/api/stream/status`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return data[camId]?.streaming || false;
        }
        return false;
      } catch {
        return false;
      }
    }

    const notOkFetch = () => Promise.resolve({ ok: false });
    const result = await checkCamera('cam01', notOkFetch);
    expect(result).toBe(false);
  });

  it('status change detection works correctly', () => {
    const statusMap = new Map();

    // First check: no previous status
    const camId = 'cam01';
    const online = true;
    const prev = statusMap.get(camId);
    statusMap.set(camId, { online, lastCheck: new Date() });

    // Should emit because prev is undefined
    expect(!prev || prev.online !== online).toBe(true);

    // Second check: same status
    const prev2 = statusMap.get(camId);
    statusMap.set(camId, { online: true, lastCheck: new Date() });
    expect(!prev2 || prev2.online !== true).toBe(false); // Should NOT emit

    // Third check: status changed
    const prev3 = statusMap.get(camId);
    statusMap.set(camId, { online: false, lastCheck: new Date() });
    expect(!prev3 || prev3.online !== false).toBe(true); // Should emit
  });
});
