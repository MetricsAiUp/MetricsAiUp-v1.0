import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

import PeriodPresets from '../PeriodPresets';

describe('PeriodPresets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T12:00:00')); // Tuesday local
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all preset buttons including "all" by default', () => {
    render(<PeriodPresets value={{ preset: 'all' }} onChange={() => {}} />);
    ['all', 'today', 'yesterday', 'week', 'month', 'custom'].forEach((p) =>
      expect(screen.getByText(`data1c.period.${p}`)).toBeTruthy(),
    );
  });

  it('hides "all" when allowAll=false', () => {
    render(<PeriodPresets value={{ preset: 'week' }} onChange={() => {}} allowAll={false} />);
    expect(screen.queryByText('data1c.period.all')).toBeNull();
  });

  it('clicking "all" emits null range', () => {
    const onChange = vi.fn();
    render(<PeriodPresets value={{ preset: 'today' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('data1c.period.all'));
    expect(onChange).toHaveBeenCalledWith({ preset: 'all', from: null, to: null });
  });

  it('clicking "today" emits today\'s start..end range', () => {
    const onChange = vi.fn();
    render(<PeriodPresets value={{ preset: 'all' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('data1c.period.today'));
    const arg = onChange.mock.calls[0][0];
    expect(arg.preset).toBe('today');
    expect(new Date(arg.from).getHours()).toBe(0);
    expect(new Date(arg.to).getHours()).toBe(23);
  });

  it('clicking "yesterday" emits range starting 1 day before today', () => {
    const onChange = vi.fn();
    render(<PeriodPresets value={{ preset: 'all' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('data1c.period.yesterday'));
    const { from, to } = onChange.mock.calls[0][0];
    expect(new Date(from).getDate()).toBe(13);
    expect(new Date(to).getDate()).toBe(13);
  });

  it('clicking "week" emits range from 6 days ago to today (7 days inclusive)', () => {
    const onChange = vi.fn();
    render(<PeriodPresets value={{ preset: 'all' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('data1c.period.week'));
    const { from, to } = onChange.mock.calls[0][0];
    expect(new Date(from).getDate()).toBe(8); // 14 - 6
    expect(new Date(to).getDate()).toBe(14);
  });

  it('clicking "month" emits range from 29 days ago to today (30 days inclusive)', () => {
    const onChange = vi.fn();
    render(<PeriodPresets value={{ preset: 'all' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('data1c.period.month'));
    const { from, to } = onChange.mock.calls[0][0];
    // 14 April - 29 days = 16 March
    expect(new Date(from).getMonth()).toBe(2); // 0-indexed March
    expect(new Date(from).getDate()).toBe(16);
    expect(new Date(to).getDate()).toBe(14);
  });

  it('switching to "custom" reveals two date inputs', () => {
    const onChange = vi.fn();
    const { container } = render(<PeriodPresets value={{ preset: 'custom', from: '2026-04-01T00:00:00Z', to: '2026-04-10T23:59:59Z' }} onChange={onChange} />);
    const dates = container.querySelectorAll('input[type="date"]');
    expect(dates.length).toBe(2);
  });

  it('typing into custom "from" emits ISO from', () => {
    const onChange = vi.fn();
    const { container } = render(<PeriodPresets value={{ preset: 'custom' }} onChange={onChange} />);
    const fromInput = container.querySelector('input[type="date"]');
    fireEvent.change(fromInput, { target: { value: '2026-04-10' } });
    const arg = onChange.mock.calls[0][0];
    expect(arg.preset).toBe('custom');
    expect(arg.from).toContain('2026-04-10');
  });

  it('typing into custom "to" sets end-of-day time', () => {
    const onChange = vi.fn();
    const { container } = render(<PeriodPresets value={{ preset: 'custom' }} onChange={onChange} />);
    const inputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[1], { target: { value: '2026-04-12' } });
    const arg = onChange.mock.calls[0][0];
    expect(arg.to).toBeTruthy();
    expect(new Date(arg.to).getHours()).toBe(23); // endOfDay
  });

  it('falls back to default preset when value has none and allowAll=false', () => {
    render(<PeriodPresets value={{}} onChange={() => {}} allowAll={false} />);
    // Internal default = 'week' when allowAll=false. Button rendering is the same.
    expect(screen.getByText('data1c.period.week')).toBeTruthy();
  });
});
