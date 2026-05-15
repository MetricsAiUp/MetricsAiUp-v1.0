import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, args) => {
      if (k === 'common.agoHours') return `${args.n}h ${args.m}m ago`;
      if (k === 'common.agoMinutes') return `${args.n}m ago`;
      if (k === 'common.dataStaleTitle') return 'TITLE';
      if (k === 'common.dataStaleBody') return `BODY ${args?.ago || ''}`;
      if (k === 'common.dataStaleNoData') return 'NODATA';
      return k;
    },
  }),
}));

import StaleDataBanner from '../StaleDataBanner';

describe('StaleDataBanner', () => {
  it('renders nothing when stale=false', () => {
    const { container } = render(<StaleDataBanner stale={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "no data" body when dataAsOf is missing', () => {
    render(<StaleDataBanner stale={true} />);
    expect(screen.getByText('NODATA')).toBeTruthy();
  });

  it('shows minutes ago when dataAgeMs < 1 hour', () => {
    render(<StaleDataBanner stale dataAsOf="2026-04-14T10:00:00Z" dataAgeMs={30 * 60 * 1000} />);
    expect(screen.getByText(/BODY 30m ago/)).toBeTruthy();
  });

  it('shows hours+minutes when dataAgeMs >= 1 hour', () => {
    render(<StaleDataBanner stale dataAsOf="2026-04-14T10:00:00Z" dataAgeMs={(2 * 60 + 15) * 60 * 1000} />);
    expect(screen.getByText(/BODY 2h 15m ago/)).toBeTruthy();
  });

  it('clamps tiny ages to "1m ago" at minimum', () => {
    render(<StaleDataBanner stale dataAsOf="now" dataAgeMs={500} />);
    expect(screen.getByText(/BODY 1m ago/)).toBeTruthy();
  });

  it('renders with role=alert for accessibility', () => {
    render(<StaleDataBanner stale dataAsOf="now" dataAgeMs={60000} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
