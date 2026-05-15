import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, args) => {
      if (args && args.n != null) return `${k}:${args.n}`;
      return k;
    },
  }),
}));

import ServiceRow from '../ServiceRow';

const NOW = new Date('2026-04-14T12:00:00Z').getTime();

describe('ServiceRow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders service name', () => {
    render(<ServiceRow service={{ name: 'IMAP Fetcher', running: true, ticks: 5, errors: 0 }} />);
    expect(screen.getByText('IMAP Fetcher')).toBeTruthy();
  });

  it('shows status dot in green when running and no errors', () => {
    const { container } = render(
      <ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0 }} />,
    );
    const dot = container.querySelector('span[style*="background"]');
    expect(dot.getAttribute('style')).toContain('rgb(16, 185, 129)');
  });

  it('shows yellow dot when running but has lastError', () => {
    const { container } = render(
      <ServiceRow service={{ name: 'X', running: true, lastError: 'boom', ticks: 1, errors: 1 }} />,
    );
    const dot = container.querySelector('span[style*="background"]');
    expect(dot.getAttribute('style')).toContain('rgb(245, 158, 11)');
  });

  it('shows red dot when not running', () => {
    const { container } = render(
      <ServiceRow service={{ name: 'X', running: false, ticks: 0, errors: 0 }} />,
    );
    const dot = container.querySelector('span[style*="background"]');
    expect(dot.getAttribute('style')).toContain('rgb(239, 68, 68)');
  });

  it('renders ticks count', () => {
    render(<ServiceRow service={{ name: 'X', running: true, ticks: 42, errors: 0 }} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('defaults ticks to 0 when missing', () => {
    render(<ServiceRow service={{ name: 'X', running: true, errors: 0 }} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows errors count only when > 0', () => {
    const { rerender } = render(
      <ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0 }} />,
    );
    expect(screen.queryByText(/^3$/)).toBeNull();
    rerender(<ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 3 }} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('formats meta interval >= 1000ms as seconds', () => {
    render(
      <ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0, meta: { type: 'cron', interval: 30000 } }} />,
    );
    expect(screen.getByText('cron • 30s')).toBeTruthy();
  });

  it('formats meta interval < 1000ms as ms', () => {
    render(
      <ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0, meta: { interval: 500 } }} />,
    );
    expect(screen.getByText('500ms')).toBeTruthy();
  });

  it('hides meta block when no type and no interval', () => {
    const { container } = render(
      <ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0, meta: {} }} />,
    );
    expect(container.textContent).not.toContain('•');
  });

  it('shows "never" when lastTickAt is missing', () => {
    render(<ServiceRow service={{ name: 'X', running: true, ticks: 0, errors: 0 }} />);
    expect(screen.getByText('health.never')).toBeTruthy();
  });

  it('formats fresh lastTickAt as "now"', () => {
    const lastTickAt = new Date(NOW - 2000).toISOString();
    render(<ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0, lastTickAt }} />);
    expect(screen.getByText('health.ago.now')).toBeTruthy();
  });

  it('formats lastTickAt in minutes range', () => {
    const lastTickAt = new Date(NOW - 5 * 60 * 1000).toISOString();
    render(<ServiceRow service={{ name: 'X', running: true, ticks: 1, errors: 0, lastTickAt }} />);
    expect(screen.getByText('health.ago.minutesAgo:5')).toBeTruthy();
  });
});
