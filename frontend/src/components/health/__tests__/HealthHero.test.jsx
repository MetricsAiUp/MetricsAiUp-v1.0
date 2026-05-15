import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, fallback) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'ru' },
  }),
}));

import HealthHero from '../HealthHero';

const baseSnapshot = {
  verdict: { score: 95, level: 'ok', failures: [] },
  backend: { uptime: 3600 },
  pulse: { eventsLast5m: 42 },
  cameras: { online: 8, total: 10 },
  ssl: { daysLeft: 60 },
};

describe('HealthHero', () => {
  it('renders score number', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('95')).toBeTruthy();
  });

  it('uses verdict.level if provided', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('health.level.ok')).toBeTruthy();
  });

  it('falls back to scoreLevel(score) when verdict.level missing', () => {
    const snap = { ...baseSnapshot, verdict: { score: 50, failures: [] } };
    render(<HealthHero snapshot={snap} />);
    // score 50 → critical
    expect(screen.getByText('health.level.critical')).toBeTruthy();
  });

  it('shows noFailures message when failures empty', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('health.noFailures')).toBeTruthy();
  });

  it('shows active issues count in RU when failures non-empty', () => {
    const snap = { ...baseSnapshot, verdict: { score: 60, level: 'warn', failures: ['cv_down', 'low_disk'] } };
    render(<HealthHero snapshot={snap} />);
    expect(screen.getByText('Активных проблем: 2')).toBeTruthy();
  });

  it('renders failure chips (up to 6)', () => {
    const failures = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const snap = { ...baseSnapshot, verdict: { score: 30, level: 'critical', failures } };
    const { container } = render(<HealthHero snapshot={snap} />);
    const chips = container.querySelectorAll('.rounded-full');
    // 6 chips (slice 0,6); dot itself is also rounded-full → so >= 6
    expect(chips.length).toBeGreaterThanOrEqual(6);
  });

  it('renders uptime KPI', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    // 3600s = 1h 0m → "1ч 0м"
    expect(screen.getByText('1ч 0м')).toBeTruthy();
  });

  it('renders events count', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders cameras online/total', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('8/10')).toBeTruthy();
  });

  it('renders SSL daysLeft with units', () => {
    render(<HealthHero snapshot={baseSnapshot} />);
    expect(screen.getByText('60 health.units.days')).toBeTruthy();
  });

  it('renders em-dash when daysLeft missing', () => {
    const snap = { ...baseSnapshot, ssl: {} };
    render(<HealthHero snapshot={snap} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn();
    const { container } = render(<HealthHero snapshot={baseSnapshot} onRefresh={onRefresh} />);
    const btn = container.querySelector('button');
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('applies animate-spin to refresh icon when refreshing', () => {
    const { container } = render(<HealthHero snapshot={baseSnapshot} refreshing />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders lastUpdate timestamp when provided', () => {
    const lastUpdate = new Date('2026-04-14T12:34:56');
    const { container } = render(<HealthHero snapshot={baseSnapshot} lastUpdate={lastUpdate} />);
    // RU locale toLocaleTimeString
    expect(container.textContent).toMatch(/12:34:56/);
  });

  it('uses default score=0 when snapshot is empty', () => {
    const { container } = render(<HealthHero snapshot={{}} />);
    // Score is the largest number in the layout
    const big = container.querySelector('.text-4xl');
    expect(big.textContent).toBe('0');
  });
});
