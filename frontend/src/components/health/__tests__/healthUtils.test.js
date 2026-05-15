import { describe, it, expect } from 'vitest';
import {
  statusToLevel, pctToLevel, scoreLevel,
  formatBytes, formatUptime, formatAge, formatDuration,
  LEVEL_COLOR, LEVEL_BG,
} from '../healthUtils';

describe('statusToLevel', () => {
  it('maps ok/success/running → ok', () => {
    ['ok', 'success', 'running'].forEach((s) => expect(statusToLevel(s)).toBe('ok'));
  });
  it('maps degraded/warn → warn', () => {
    ['degraded', 'warn'].forEach((s) => expect(statusToLevel(s)).toBe('warn'));
  });
  it('maps down/error/critical → critical', () => {
    ['down', 'error', 'critical'].forEach((s) => expect(statusToLevel(s)).toBe('critical'));
  });
  it('defaults unknown to warn', () => {
    expect(statusToLevel('whatever')).toBe('warn');
    expect(statusToLevel(undefined)).toBe('warn');
  });
});

describe('pctToLevel', () => {
  it('returns ok when below warnAt threshold', () => {
    expect(pctToLevel(50)).toBe('ok');
    expect(pctToLevel(80)).toBe('ok');
  });
  it('returns warn between warnAt and critAt', () => {
    expect(pctToLevel(86)).toBe('warn');
    expect(pctToLevel(94)).toBe('warn');
  });
  it('returns critical at/above critAt', () => {
    expect(pctToLevel(95)).toBe('critical');
    expect(pctToLevel(99)).toBe('critical');
  });
  it('accepts custom thresholds', () => {
    expect(pctToLevel(60, 50, 70)).toBe('warn');
    expect(pctToLevel(75, 50, 70)).toBe('critical');
  });
  it('returns ok for null', () => {
    expect(pctToLevel(null)).toBe('ok');
  });
});

describe('scoreLevel', () => {
  it('returns ok for score ≥ 90', () => {
    expect(scoreLevel(100)).toBe('ok');
    expect(scoreLevel(90)).toBe('ok');
  });
  it('returns warn for 70 ≤ score < 90', () => {
    expect(scoreLevel(80)).toBe('warn');
    expect(scoreLevel(70)).toBe('warn');
  });
  it('returns critical for score < 70', () => {
    expect(scoreLevel(50)).toBe('critical');
    expect(scoreLevel(0)).toBe('critical');
  });
  it('defaults null to warn', () => {
    expect(scoreLevel(null)).toBe('warn');
  });
});

describe('formatBytes', () => {
  it('returns em-dash for null/NaN', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });
  it('formats >= 1 GB', () => {
    expect(formatBytes(2147483648)).toMatch(/2\.0 ГБ/);
  });
  it('formats >= 1 MB but < 1 GB', () => {
    expect(formatBytes(5 * 1048576)).toMatch(/5 МБ/);
  });
  it('formats < 1 MB as KB', () => {
    expect(formatBytes(2048)).toMatch(/2 КБ/);
  });
});

describe('formatUptime', () => {
  it('formats days/hours/minutes (RU default)', () => {
    expect(formatUptime(2 * 86400 + 3 * 3600 + 5 * 60)).toBe('2д 3ч 5м');
  });
  it('formats hours/minutes when no days', () => {
    expect(formatUptime(5 * 3600 + 30 * 60)).toBe('5ч 30м');
  });
  it('formats minutes/seconds when no hours', () => {
    expect(formatUptime(75)).toBe('1м 15с');
  });
  it('formats seconds only when < 1 min', () => {
    expect(formatUptime(42)).toBe('42с');
  });
  it('uses English suffixes when isRu=false', () => {
    expect(formatUptime(86400, false)).toBe('1d 0h 0m');
    expect(formatUptime(3600, false)).toBe('1h 0m');
    expect(formatUptime(60, false)).toBe('1m 0s');
    expect(formatUptime(10, false)).toBe('10s');
  });
  it('returns em-dash for null', () => {
    expect(formatUptime(null)).toBe('—');
  });
});

describe('formatAge', () => {
  const tStub = (k, args) => args ? `${k}:${args.n}` : k;
  it('returns never key for null', () => {
    expect(formatAge(null, tStub)).toBe('health.never');
  });
  it('handles "now" for < 5s', () => {
    expect(formatAge(2, tStub)).toBe('health.ago.now');
  });
  it('handles seconds bucket', () => {
    expect(formatAge(30, tStub)).toBe('health.ago.secondsAgo:30');
  });
  it('handles minutes bucket', () => {
    expect(formatAge(180, tStub)).toBe('health.ago.minutesAgo:3');
  });
  it('handles hours bucket', () => {
    expect(formatAge(7200, tStub)).toBe('health.ago.hoursAgo:2');
  });
  it('handles days bucket', () => {
    expect(formatAge(86400 * 3, tStub)).toBe('health.ago.daysAgo:3');
  });
});

describe('formatDuration', () => {
  it('returns em-dash for null', () => {
    expect(formatDuration(null)).toBe('—');
  });
  it('formats < 1s in milliseconds', () => {
    expect(formatDuration(500)).toBe('500 мс');
  });
  it('formats >= 1s in seconds with 2 decimals', () => {
    expect(formatDuration(2500)).toBe('2.50 с');
  });
});

describe('LEVEL_COLOR / LEVEL_BG constants', () => {
  it('exposes three levels', () => {
    expect(LEVEL_COLOR.ok).toBeTruthy();
    expect(LEVEL_COLOR.warn).toBeTruthy();
    expect(LEVEL_COLOR.critical).toBeTruthy();
    expect(LEVEL_BG.ok).toBeTruthy();
    expect(LEVEL_BG.warn).toBeTruthy();
    expect(LEVEL_BG.critical).toBeTruthy();
  });
});
