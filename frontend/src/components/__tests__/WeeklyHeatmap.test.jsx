import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import WeeklyHeatmap from '../WeeklyHeatmap';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

const makeMockData = () =>
  Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    hours: Array.from({ length: 12 }, (_, hi) => ({
      hour: hi + 8,
      avgOccupancy: Math.floor(Math.random() * 100),
    })),
  }));

describe('WeeklyHeatmap', () => {
  it('renders nothing when data is empty', () => {
    const { container } = render(<WeeklyHeatmap data={[]} isRu={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(<WeeklyHeatmap data={null} isRu={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders 7 rows (days) and 12 hour columns', () => {
    const data = makeMockData();
    const { container } = render(<WeeklyHeatmap data={data} isRu={false} />);
    const tbody = container.querySelector('tbody');
    expect(tbody).toBeInTheDocument();
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(7);

    // Each row should have 1 day name cell + 12 hour cells = 13 cells
    const firstRowCells = rows[0].querySelectorAll('td');
    expect(firstRowCells.length).toBe(13);

    // Header should have 13 th elements (1 day label + 12 hours)
    const thead = container.querySelector('thead');
    const ths = thead.querySelectorAll('th');
    expect(ths.length).toBe(13);
  });

  it('shows Russian day names when isRu=true', () => {
    const data = makeMockData();
    const { container } = render(<WeeklyHeatmap data={data} isRu={true} />);
    const tbody = container.querySelector('tbody');
    const firstCell = tbody.querySelectorAll('tr')[0].querySelectorAll('td')[0];
    expect(firstCell.textContent).toBe('\u041F\u043D'); // "Пн"

    // Check header label
    const thead = container.querySelector('thead');
    const firstTh = thead.querySelectorAll('th')[0];
    expect(firstTh.textContent).toBe('\u0414\u0435\u043D\u044C'); // "День"
  });

  it('shows English day names when isRu=false', () => {
    const data = makeMockData();
    const { container } = render(<WeeklyHeatmap data={data} isRu={false} />);
    const tbody = container.querySelector('tbody');
    const firstCell = tbody.querySelectorAll('tr')[0].querySelectorAll('td')[0];
    expect(firstCell.textContent).toBe('Mon');

    const thead = container.querySelector('thead');
    const firstTh = thead.querySelectorAll('th')[0];
    expect(firstTh.textContent).toBe('Day');
  });
});
