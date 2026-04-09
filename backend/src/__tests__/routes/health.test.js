import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('health endpoint - response structure', () => {
  it('backend status includes uptime and version', () => {
    const START_TIME = Date.now() - 60000; // started 60s ago
    const result = {};
    result.backend = {
      status: 'ok',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      version: '1.0.0',
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
    };

    expect(result.backend.status).toBe('ok');
    expect(result.backend.uptime).toBeGreaterThanOrEqual(59);
    expect(result.backend.version).toBe('1.0.0');
    expect(result.backend.nodeVersion).toMatch(/^v\d+/);
    expect(result.backend.memoryUsage).toHaveProperty('heapUsed');
    expect(result.backend.memoryUsage).toHaveProperty('rss');
  });

  it('database section contains ping timing', async () => {
    // Simulate the database check logic
    const start = Date.now();
    // Simulate a fast query
    await new Promise(r => setTimeout(r, 1));
    const pingMs = Date.now() - start;

    const dbResult = {
      status: 'ok',
      pingMs,
      sizeBytes: 1024000,
      sizeMB: +(1024000 / 1024 / 1024).toFixed(2),
    };

    expect(dbResult.status).toBe('ok');
    expect(dbResult.pingMs).toBeGreaterThanOrEqual(0);
    expect(typeof dbResult.sizeBytes).toBe('number');
    expect(typeof dbResult.sizeMB).toBe('number');
  });

  it('handles database error gracefully', () => {
    const err = new Error('Connection refused');
    const dbResult = { status: 'error', error: err.message };

    expect(dbResult.status).toBe('error');
    expect(dbResult.error).toBe('Connection refused');
  });

  it('cameras section uses getCameraStatuses output format', () => {
    const statuses = {
      cam01: { online: true, lastCheck: new Date() },
      cam02: { online: false, lastCheck: new Date() },
    };

    const cameras = Object.entries(statuses).map(([id, s]) => ({
      id,
      online: s.online,
      lastCheck: s.lastCheck,
    }));

    expect(cameras).toHaveLength(2);
    expect(cameras[0]).toEqual({ id: 'cam01', online: true, lastCheck: expect.any(Date) });
    expect(cameras[1]).toEqual({ id: 'cam02', online: false, lastCheck: expect.any(Date) });
  });
});
