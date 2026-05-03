import { describe, it, expect } from 'vitest';
import { computeVerdict, _internal } from '../../services/healthMetrics.js';

describe('healthMetrics.computeVerdict', () => {
  const baseSnapshot = () => ({
    backend: { heapPercent: 40 },
    database: { status: 'ok', pingMs: 2 },
    sync1c: { status: 'success', ageHours: 1 },
    dataSources: {
      cvApi: { status: 'ok', lastFetchAgeSec: 5 },
      mlApi: { status: 'ok' },
      hls: { status: 'ok' },
      telegram: { status: 'ok' },
    },
    pulse: { lastEventAgeSec: 10 },
    disk: { usagePercent: 30 },
    ssl: { daysLeft: 100 },
  });

  it('всё OK → score 100, level ok, failures пуст', () => {
    const v = computeVerdict(baseSnapshot());
    expect(v.score).toBe(100);
    expect(v.level).toBe('ok');
    expect(v.failures).toEqual([]);
  });

  it('CV API down → штраф 30', () => {
    const s = baseSnapshot();
    s.dataSources.cvApi.status = 'down';
    const v = computeVerdict(s);
    expect(v.score).toBe(70);
    expect(v.failures).toContain('cv_api_down');
    expect(v.level).toBe('warn');
  });

  it('CV API stale (>60s) → штраф 15', () => {
    const s = baseSnapshot();
    s.dataSources.cvApi.lastFetchAgeSec = 120;
    const v = computeVerdict(s);
    expect(v.score).toBe(85);
    expect(v.failures).toContain('cv_api_stale');
    expect(v.level).toBe('warn');
  });

  it('events_silent (>10 мин) → штраф 20', () => {
    const s = baseSnapshot();
    s.pulse.lastEventAgeSec = 700;
    const v = computeVerdict(s);
    expect(v.score).toBe(80);
    expect(v.failures).toContain('events_silent');
  });

  it('БД error → штраф 25 + critical', () => {
    const s = baseSnapshot();
    s.database.status = 'error';
    const v = computeVerdict(s);
    expect(v.score).toBe(75);
    expect(v.failures).toContain('db_error');
  });

  it('heap >95% critical, 85-95% warn', () => {
    let s = baseSnapshot();
    s.backend.heapPercent = 96;
    expect(computeVerdict(s).failures).toContain('heap_critical');
    s = baseSnapshot();
    s.backend.heapPercent = 90;
    expect(computeVerdict(s).failures).toContain('heap_warn');
  });

  it('disk >95% critical, 85-95% warn', () => {
    let s = baseSnapshot();
    s.disk.usagePercent = 96;
    expect(computeVerdict(s).failures).toContain('disk_critical');
    s = baseSnapshot();
    s.disk.usagePercent = 87;
    expect(computeVerdict(s).failures).toContain('disk_warn');
  });

  it('1С >24ч warn, >7d critical', () => {
    let s = baseSnapshot();
    s.sync1c.ageHours = 30;
    expect(computeVerdict(s).failures).toContain('sync1c_stale');
    s = baseSnapshot();
    s.sync1c.ageHours = 24 * 8;
    expect(computeVerdict(s).failures).toContain('sync1c_stale_critical');
  });

  it('SSL <30 дней warn, <7 critical', () => {
    let s = baseSnapshot();
    s.ssl.daysLeft = 20;
    expect(computeVerdict(s).failures).toContain('ssl_expiring');
    s = baseSnapshot();
    s.ssl.daysLeft = 5;
    expect(computeVerdict(s).failures).toContain('ssl_critical');
  });

  it('ML/HLS/Telegram down — каждый по 5 баллов', () => {
    const s = baseSnapshot();
    s.dataSources.mlApi.status = 'down';
    s.dataSources.hls.status = 'down';
    s.dataSources.telegram.status = 'down';
    const v = computeVerdict(s);
    expect(v.score).toBe(85);
    expect(v.failures).toEqual(expect.arrayContaining(['ml_down', 'hls_down', 'telegram_down']));
  });

  it('много проблем → critical уровень (score < 70)', () => {
    const s = baseSnapshot();
    s.dataSources.cvApi.status = 'down';     // -30
    s.pulse.lastEventAgeSec = 700;            // -20
    s.backend.heapPercent = 96;               // -15
    s.disk.usagePercent = 96;                 // -15
    const v = computeVerdict(s);
    expect(v.score).toBeLessThan(70);
    expect(v.level).toBe('critical');
  });

  it('score не уходит ниже 0', () => {
    const s = baseSnapshot();
    s.dataSources.cvApi.status = 'down';
    s.pulse.lastEventAgeSec = 700;
    s.database.status = 'error';
    s.backend.heapPercent = 99;
    s.disk.usagePercent = 99;
    s.sync1c.ageHours = 24 * 30;
    s.ssl.daysLeft = 1;
    s.dataSources.mlApi.status = 'down';
    s.dataSources.hls.status = 'down';
    s.dataSources.telegram.status = 'down';
    const v = computeVerdict(s);
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.level).toBe('critical');
  });

  it('пограничные значения порогов score', () => {
    let s = baseSnapshot();
    s.disk.usagePercent = 87;                 // -5 → 95 (ok)
    expect(computeVerdict(s).level).toBe('ok');
    s.backend.heapPercent = 90;               // -5 → 90 (ok, граница)
    expect(computeVerdict(s).level).toBe('ok');
    s.sync1c.ageHours = 30;                   // -3 → 87 (warn)
    expect(computeVerdict(s).level).toBe('warn');
  });
});

describe('healthMetrics._internal helpers', () => {
  it('ageSeconds возвращает null для null', () => {
    expect(_internal.ageSeconds(null)).toBeNull();
  });

  it('ageSeconds считает разницу в секундах', () => {
    const date = new Date(Date.now() - 5000);
    const age = _internal.ageSeconds(date);
    expect(age).toBeGreaterThanOrEqual(4);
    expect(age).toBeLessThanOrEqual(6);
  });

  it('ageSeconds работает с ISO-строкой', () => {
    const iso = new Date(Date.now() - 10000).toISOString();
    const age = _internal.ageSeconds(iso);
    expect(age).toBeGreaterThanOrEqual(9);
    expect(age).toBeLessThanOrEqual(11);
  });

  it('ageSeconds возвращает null для невалидной даты', () => {
    expect(_internal.ageSeconds('not-a-date')).toBeNull();
  });
});
