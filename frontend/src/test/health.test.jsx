import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  scoreLevel, statusToLevel, pctToLevel, formatBytes,
  formatUptime, formatAge, formatDuration,
} from '../components/health/healthUtils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, opts) => (typeof opts === 'object' && opts?.n != null ? `${k}:${opts.n}` : k),
    i18n: { language: 'ru', changeLanguage: vi.fn() },
  }),
}));

describe('healthUtils.scoreLevel', () => {
  it('100 → ok, 90 → ok', () => {
    expect(scoreLevel(100)).toBe('ok');
    expect(scoreLevel(90)).toBe('ok');
  });
  it('89 → warn, 70 → warn', () => {
    expect(scoreLevel(89)).toBe('warn');
    expect(scoreLevel(70)).toBe('warn');
  });
  it('69 → critical, 0 → critical', () => {
    expect(scoreLevel(69)).toBe('critical');
    expect(scoreLevel(0)).toBe('critical');
  });
  it('null → warn', () => {
    expect(scoreLevel(null)).toBe('warn');
  });
});

describe('healthUtils.statusToLevel', () => {
  it('ok / success / running → ok', () => {
    expect(statusToLevel('ok')).toBe('ok');
    expect(statusToLevel('success')).toBe('ok');
    expect(statusToLevel('running')).toBe('ok');
  });
  it('degraded / warn → warn', () => {
    expect(statusToLevel('degraded')).toBe('warn');
    expect(statusToLevel('warn')).toBe('warn');
  });
  it('down / error / critical → critical', () => {
    expect(statusToLevel('down')).toBe('critical');
    expect(statusToLevel('error')).toBe('critical');
    expect(statusToLevel('critical')).toBe('critical');
  });
});

describe('healthUtils.pctToLevel', () => {
  it('< 85 → ok', () => expect(pctToLevel(50)).toBe('ok'));
  it('85-94 → warn', () => expect(pctToLevel(90)).toBe('warn'));
  it('>= 95 → critical', () => expect(pctToLevel(96)).toBe('critical'));
});

describe('healthUtils.formatBytes', () => {
  it('returns ГБ для больших значений', () => {
    expect(formatBytes(2 * 1073741824)).toMatch(/2\.0 ГБ/);
  });
  it('returns МБ для средних', () => {
    expect(formatBytes(50 * 1048576)).toMatch(/50 МБ/);
  });
  it('null → —', () => {
    expect(formatBytes(null)).toBe('—');
  });
});

describe('healthUtils.formatUptime', () => {
  it('форматирует дни', () => {
    expect(formatUptime(2 * 86400 + 3 * 3600 + 4 * 60, true)).toBe('2д 3ч 4м');
  });
  it('часы без дней', () => {
    expect(formatUptime(3 * 3600 + 4 * 60, true)).toBe('3ч 4м');
  });
  it('минуты без часов', () => {
    expect(formatUptime(2 * 60 + 30, true)).toBe('2м 30с');
  });
});

describe('healthUtils.formatAge', () => {
  const t = (k, opts) => (opts?.n != null ? `${k}:${opts.n}` : k);
  it('< 5 → now', () => expect(formatAge(2, t)).toBe('health.ago.now'));
  it('< 60 → secondsAgo', () => expect(formatAge(30, t)).toBe('health.ago.secondsAgo:30'));
  it('минуты', () => expect(formatAge(120, t)).toBe('health.ago.minutesAgo:2'));
  it('часы', () => expect(formatAge(7200, t)).toBe('health.ago.hoursAgo:2'));
  it('дни', () => expect(formatAge(2 * 86400, t)).toBe('health.ago.daysAgo:2'));
  it('null → never', () => expect(formatAge(null, t)).toBe('health.never'));
});

describe('healthUtils.formatDuration', () => {
  it('< 1000 → мс', () => expect(formatDuration(500)).toBe('500 мс'));
  it('>= 1000 → секунды', () => expect(formatDuration(2500)).toBe('2.50 с'));
});

describe('HealthHero rendering', () => {
  it('всё OK — отображает "All good" уровень', async () => {
    const HealthHero = (await import('../components/health/HealthHero')).default;
    render(
      <HealthHero
        snapshot={{
          verdict: { score: 100, level: 'ok', failures: [] },
          backend: { uptime: 3600 },
          pulse: { eventsLast5m: 5 },
          cameras: { online: 16, total: 16 },
          ssl: { daysLeft: 100 },
        }}
        lastUpdate={null}
        onRefresh={() => {}}
        refreshing={false}
      />
    );
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('health.level.ok')).toBeTruthy();
    expect(screen.getByText('health.noFailures')).toBeTruthy();
  });

  it('критичный — показывает level critical и failure-чипы', async () => {
    const HealthHero = (await import('../components/health/HealthHero')).default;
    render(
      <HealthHero
        snapshot={{
          verdict: { score: 50, level: 'critical', failures: ['cv_api_down', 'events_silent'] },
          backend: { uptime: 100 },
          pulse: { eventsLast5m: 0 },
          cameras: { online: 0, total: 16 },
          ssl: { daysLeft: 5 },
        }}
        lastUpdate={null}
        onRefresh={() => {}}
        refreshing={false}
      />
    );
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('health.level.critical')).toBeTruthy();
    expect(screen.getByText('health.failures.cv_api_down')).toBeTruthy();
    expect(screen.getByText('health.failures.events_silent')).toBeTruthy();
  });
});
