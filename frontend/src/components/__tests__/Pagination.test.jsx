import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../Pagination';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (k) => k }),
}));

describe('Pagination', () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    totalItems: 50,
    perPage: 10,
    onPageChange: vi.fn(),
    onPerPageChange: vi.fn(),
  };

  it('renders page info text', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('1–10 of 50')).toBeTruthy();
  });

  it('renders perPage selector by default', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('Rows per page:')).toBeTruthy();
  });

  it('hides perPage selector when showPerPage=false', () => {
    render(<Pagination {...defaultProps} showPerPage={false} />);
    expect(screen.queryByText('Rows per page:')).toBeNull();
  });

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);
    // Find the ChevronRight button (second-to-last button)
    const buttons = screen.getAllByRole('button');
    // buttons: [ChevronsLeft, ChevronLeft, 1,2,3,4,5, ChevronRight, ChevronsRight]
    const nextBtn = buttons[buttons.length - 2];
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev buttons on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].disabled).toBe(true); // ChevronsLeft
    expect(buttons[1].disabled).toBe(true); // ChevronLeft
  });

  it('disables next buttons on last page', () => {
    render(<Pagination {...defaultProps} page={5} />);
    const buttons = screen.getAllByRole('button');
    const last = buttons[buttons.length - 1];
    const secondLast = buttons[buttons.length - 2];
    expect(last.disabled).toBe(true);
    expect(secondLast.disabled).toBe(true);
  });

  it('renders compact mode with page X / Y', () => {
    render(<Pagination {...defaultProps} compact />);
    expect(screen.getByText('1 / 5')).toBeTruthy();
  });

  it('shows "No entries" when totalItems is 0', () => {
    render(<Pagination {...defaultProps} totalItems={0} totalPages={1} />);
    expect(screen.getByText('No entries')).toBeTruthy();
  });

  it('calls onPerPageChange and resets to page 1', () => {
    const onPageChange = vi.fn();
    const onPerPageChange = vi.fn();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} onPerPageChange={onPerPageChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '20' } });
    expect(onPerPageChange).toHaveBeenCalledWith(20);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('returns null when totalPages <= 1 and showPerPage=false', () => {
    const { container } = render(
      <Pagination {...defaultProps} totalPages={1} showPerPage={false} />
    );
    expect(container.innerHTML).toBe('');
  });
});
