import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import DateRangePicker from '../DateRangePicker';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

describe('DateRangePicker', () => {
  const defaultProps = {
    dateFrom: '2026-04-01',
    dateTo: '2026-04-09',
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders date inputs', () => {
    const { container } = render(<DateRangePicker {...defaultProps} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  it('calls onDateFromChange when from-date changes', () => {
    const { container } = render(<DateRangePicker {...defaultProps} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });
    expect(defaultProps.onDateFromChange).toHaveBeenCalledWith('2026-05-01');
  });

  it('calls onDateToChange when to-date changes', () => {
    const { container } = render(<DateRangePicker {...defaultProps} />);
    const dateInputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: '2026-05-15' } });
    expect(defaultProps.onDateToChange).toHaveBeenCalledWith('2026-05-15');
  });

  it('renders 5 preset buttons', () => {
    const { getAllByRole } = render(<DateRangePicker {...defaultProps} />);
    const buttons = getAllByRole('button');
    expect(buttons.length).toBe(5);
  });

  it('preset buttons call onChange correctly', () => {
    const { getAllByRole } = render(<DateRangePicker {...defaultProps} />);
    const buttons = getAllByRole('button');

    // Click first button (today)
    fireEvent.click(buttons[0]);
    expect(defaultProps.onDateFromChange).toHaveBeenCalled();
    expect(defaultProps.onDateToChange).toHaveBeenCalled();
  });

  it('"allDates" preset clears both dates', () => {
    const { getAllByRole } = render(<DateRangePicker {...defaultProps} />);
    const buttons = getAllByRole('button');

    // Last button is "allDates"
    fireEvent.click(buttons[4]);
    expect(defaultProps.onDateFromChange).toHaveBeenCalledWith('');
    expect(defaultProps.onDateToChange).toHaveBeenCalledWith('');
  });
});
