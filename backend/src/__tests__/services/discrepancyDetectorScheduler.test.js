import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use a tmp STATE_FILE by stubbing fs paths is hard — instead we'll mock the
// module's STATE_FILE constant by spying on its read/write helpers.
const scheduler = require('../../services/discrepancyDetectorScheduler');
const detector = require('../../services/discrepancyDetector');

// Tmp file we use for round-tripping state
const TMP_STATE = path.join(os.tmpdir(), `dscheduler-${Date.now()}.json`);

describe('discrepancyDetectorScheduler — state helpers', () => {
  afterEach(() => {
    try { fs.unlinkSync(TMP_STATE); } catch {}
    vi.restoreAllMocks();
  });

  it('_readState returns defaults when file absent', () => {
    const origExists = fs.existsSync;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) =>
      p === scheduler._STATE_FILE ? false : origExists(p),
    );
    const state = scheduler._readState();
    expect(state.enabled).toBe(true);
    expect(state.time).toBe('08:00');
    expect(state.timezone).toBe('Europe/Minsk');
    expect(state.sinceWindow).toBe('7d');
    expect(state.lastRunAt).toBeNull();
  });

  it('_readState merges partial file with defaults', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ time: '12:30', timezone: 'UTC' }));
    const state = scheduler._readState();
    expect(state.time).toBe('12:30');
    expect(state.timezone).toBe('UTC');
    expect(state.enabled).toBe(true); // default preserved
    expect(state.sinceWindow).toBe('7d'); // default preserved
  });

  it('_readState falls back to defaults on JSON parse error', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('garbage{');
    const state = scheduler._readState();
    expect(state.enabled).toBe(true);
    expect(state.time).toBe('08:00');
  });
});

describe('discrepancyDetectorScheduler — setConfig() validation', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    // Skip cron to avoid scheduling a real task; node-cron requires valid expr anyway
    vi.spyOn(require('node-cron'), 'schedule').mockReturnValue({ stop: () => {} });
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects invalid time format', () => {
    expect(() => scheduler.setConfig({ time: '25:99' })).toThrow(/Invalid time/);
    expect(() => scheduler.setConfig({ time: 'abc' })).toThrow(/Invalid time/);
  });

  it('accepts valid HH:MM', () => {
    expect(() => scheduler.setConfig({ time: '23:45' })).not.toThrow();
  });

  it('rejects invalid timezone', () => {
    expect(() => scheduler.setConfig({ timezone: 'Not/Real' })).toThrow(/Invalid timezone/);
  });

  it('accepts valid IANA timezone', () => {
    expect(() => scheduler.setConfig({ timezone: 'Europe/London' })).not.toThrow();
  });

  it('rejects invalid sinceWindow', () => {
    expect(() => scheduler.setConfig({ sinceWindow: '7days' })).toThrow(/Invalid sinceWindow/);
    expect(() => scheduler.setConfig({ sinceWindow: 'abc' })).toThrow(/Invalid sinceWindow/);
  });

  it('accepts valid sinceWindow like "24h", "7d", "2w"', () => {
    expect(() => scheduler.setConfig({ sinceWindow: '24h' })).not.toThrow();
    expect(() => scheduler.setConfig({ sinceWindow: '7d' })).not.toThrow();
    expect(() => scheduler.setConfig({ sinceWindow: '2w' })).not.toThrow();
  });

  it('coerces enabled to boolean', () => {
    let captured;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((_p, data) => {
      captured = JSON.parse(data);
    });
    scheduler.setConfig({ enabled: 'truthy' });
    expect(captured.enabled).toBe(true);
    scheduler.setConfig({ enabled: 0 });
    expect(captured.enabled).toBe(false);
  });
});

describe('discrepancyDetectorScheduler — runOnce()', () => {
  let fileState;
  beforeEach(() => {
    fileState = { sinceWindow: '24h' };
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(fileState));
    vi.spyOn(fs, 'writeFileSync').mockImplementation((_p, data) => { fileState = JSON.parse(data); });
  });
  afterEach(() => vi.restoreAllMocks());

  it('runs detector and records ok status with metrics', async () => {
    vi.spyOn(detector, 'detectAll').mockResolvedValue({ totalDetected: 5, totalNew: 3 });
    const writes = [];
    fs.writeFileSync.mockImplementation((_p, data) => {
      const parsed = JSON.parse(data);
      writes.push(parsed);
      fileState = parsed;
    });

    const result = await scheduler.runOnce({ trigger: 'manual' });
    expect(result.ok).toBe(true);
    expect(result.totalDetected).toBe(5);
    expect(result.totalNew).toBe(3);
    expect(typeof result.durationMs).toBe('number');

    // First write — running, then ok
    const running = writes.find((w) => w.lastStatus === 'running');
    const done = writes.find((w) => w.lastStatus === 'ok');
    expect(running).toBeTruthy();
    expect(running.lastTrigger).toBe('manual');
    expect(done).toBeTruthy();
    expect(done.lastDetected).toBe(5);
    expect(done.lastNew).toBe(3);
    expect(done.lastError).toBeNull();
  });

  it('records error status when detector throws', async () => {
    vi.spyOn(detector, 'detectAll').mockRejectedValue(new Error('boom'));
    const writes = [];
    fs.writeFileSync.mockImplementation((_p, data) => {
      const parsed = JSON.parse(data);
      writes.push(parsed);
      fileState = parsed;
    });

    const result = await scheduler.runOnce({ trigger: 'cron' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
    const err = writes.find((w) => w.lastStatus === 'error');
    expect(err).toBeTruthy();
    expect(err.lastError).toBe('boom');
    expect(err.lastTrigger).toBe('cron');
  });

  it('uses since override when provided', async () => {
    const detectSpy = vi.spyOn(detector, 'detectAll').mockResolvedValue({ totalDetected: 0, totalNew: 0 });
    await scheduler.runOnce({ since: '3d' });
    expect(detectSpy).toHaveBeenCalledWith({ since: '3d' });
  });

  it('skips concurrent run when one is already in flight (only calls detector once)', async () => {
    let resolveDetect;
    const detectSpy = vi.spyOn(detector, 'detectAll').mockReturnValue(
      new Promise((r) => { resolveDetect = r; }),
    );
    const p1 = scheduler.runOnce();
    const p2 = scheduler.runOnce(); // second call must not start a new detector run
    resolveDetect({ totalDetected: 0, totalNew: 0 });
    await Promise.all([p1, p2]);
    expect(detectSpy).toHaveBeenCalledOnce();
  });
});

describe('discrepancyDetectorScheduler — getState()', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ time: '09:15' }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns state with isRunning flag (false when idle)', () => {
    const s = scheduler.getState();
    expect(s.time).toBe('09:15');
    expect(s.isRunning).toBe(false);
  });
});
