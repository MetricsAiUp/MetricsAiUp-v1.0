import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

import FilterBar from '../FilterBar';

const fakePeriod = { preset: 'all', from: null, to: null };

describe('FilterBar', () => {
  it('renders search input when onSearchChange is provided', () => {
    render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} onSearchChange={() => {}} />);
    expect(screen.getByPlaceholderText('common.search')).toBeTruthy();
  });

  it('honors searchPlaceholder override', () => {
    render(<FilterBar onSearchChange={() => {}} searchPlaceholder="Найти ЗН" />);
    expect(screen.getByPlaceholderText('Найти ЗН')).toBeTruthy();
  });

  it('omits search when onSearchChange is missing', () => {
    render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} />);
    expect(screen.queryByPlaceholderText('common.search')).toBeNull();
  });

  it('calls onSearchChange when user types', () => {
    const onSearchChange = vi.fn();
    render(<FilterBar onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('common.search'), { target: { value: 'abc' } });
    expect(onSearchChange).toHaveBeenCalledWith('abc');
  });

  it('shows clear button when search non-empty and clears it', () => {
    const onSearchChange = vi.fn();
    render(<FilterBar search="x" onSearchChange={onSearchChange} />);
    const clearBtn = screen.getByTitle('common.clear');
    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('renders periodLabel above period control', () => {
    render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} periodLabel="По дате получения" />);
    expect(screen.getByText('По дате получения')).toBeTruthy();
  });

  it('hides PeriodPresets when showPeriod=false', () => {
    const { container } = render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} showPeriod={false} />);
    // PeriodPresets renders button group; we just check the period label is absent
    expect(container.textContent).not.toContain('data1c.period.today');
  });

  it('renders info text on the right', () => {
    render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} info="42 из 100" />);
    expect(screen.getByText('42 из 100')).toBeTruthy();
  });

  it('renders Reset button only when onReset provided and triggers it', () => {
    const onReset = vi.fn();
    render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} onReset={onReset} />);
    const btn = screen.getByText('common.reset');
    fireEvent.click(btn);
    expect(onReset).toHaveBeenCalled();
  });

  it('renders Refresh button only when onRefresh provided and disables when loading=true', () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <FilterBar period={fakePeriod} onPeriodChange={() => {}} onRefresh={onRefresh} loading />,
    );
    // Find the refresh button by spinning icon class
    const spinning = container.querySelector('.animate-spin');
    expect(spinning).toBeTruthy();
    const refreshBtn = spinning.closest('button');
    expect(refreshBtn.disabled).toBe(true);
  });

  it('renders custom children in lower row', () => {
    render(
      <FilterBar period={fakePeriod} onPeriodChange={() => {}}>
        <div data-testid="kid">extra</div>
      </FilterBar>,
    );
    expect(screen.getByTestId('kid')).toBeTruthy();
  });

  it('does not render lower row when no children/info/onRefresh/onReset', () => {
    const { container } = render(<FilterBar period={fakePeriod} onPeriodChange={() => {}} />);
    // Lower row would have flex-wrap children; just check Refresh/Reset texts missing
    expect(container.textContent).not.toContain('common.reset');
    expect(container.textContent).not.toContain('data1c.common.refresh');
  });
});
