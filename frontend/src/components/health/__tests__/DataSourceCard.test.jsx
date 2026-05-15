import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, args) => {
      if (args && args.n != null) return `${k}:${args.n}`;
      return k;
    },
  }),
}));

import DataSourceCard from '../DataSourceCard';

function Icon() { return <svg data-testid="icon" />; }

describe('DataSourceCard', () => {
  it('returns null when source is missing', () => {
    const { container } = render(<DataSourceCard icon={Icon} title="X" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and description', () => {
    render(<DataSourceCard icon={Icon} title="CV" desc="Computer Vision" source={{ status: 'ok' }} />);
    expect(screen.getByText('CV')).toBeTruthy();
    expect(screen.getByText('Computer Vision')).toBeTruthy();
  });

  it('omits description block when desc not provided', () => {
    const { container } = render(<DataSourceCard icon={Icon} title="CV" source={{ status: 'ok' }} />);
    expect(container.textContent).not.toContain('Computer Vision');
  });

  it('renders latency metric when latencyMs present', () => {
    render(<DataSourceCard icon={Icon} title="X" source={{ status: 'ok', latencyMs: 120 }} />);
    expect(screen.getByText('health.metrics.latency')).toBeTruthy();
    expect(screen.getByText('120 health.units.ms')).toBeTruthy();
  });

  it('renders http code when present', () => {
    render(<DataSourceCard icon={Icon} title="X" source={{ status: 'ok', httpCode: 200 }} />);
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('renders lastFetch age via formatAge', () => {
    render(<DataSourceCard icon={Icon} title="X" source={{ status: 'ok', lastFetchAgeSec: 120 }} />);
    expect(screen.getByText('health.ago.minutesAgo:2')).toBeTruthy();
  });

  it('renders linkedUsers when present', () => {
    render(<DataSourceCard icon={Icon} title="Telegram" source={{ status: 'ok', linkedUsers: 5 }} />);
    expect(screen.getByText('health.metrics.linkedUsers')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('appends custom metrics', () => {
    render(
      <DataSourceCard
        icon={Icon}
        title="X"
        source={{ status: 'ok' }}
        metrics={[{ label: 'Custom', value: 'V' }]}
      />,
    );
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('renders error block in red when source.error set', () => {
    render(<DataSourceCard icon={Icon} title="X" source={{ status: 'error', error: 'ECONNREFUSED' }} />);
    const err = screen.getByText('ECONNREFUSED');
    expect(err).toBeTruthy();
    expect(err.getAttribute('style')).toContain('rgb(239, 68, 68)');
  });

  it('hides metrics block when no fields', () => {
    const { container } = render(<DataSourceCard icon={Icon} title="X" source={{ status: 'ok' }} />);
    // borderTop is on metrics block; ensure no metric labels are present
    expect(container.textContent).not.toContain('health.metrics');
  });
});
