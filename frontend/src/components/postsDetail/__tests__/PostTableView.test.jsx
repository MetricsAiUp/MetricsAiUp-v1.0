import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en' } }),
}));

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Car: icon,
    Truck: icon,
    Wrench: icon,
    ChevronRight: icon,
  };
});

import PostTableView from '../PostTableView';

describe('PostTableView', () => {
  const mockNavigate = vi.fn();

  const samplePosts = [
    {
      id: 'post-1',
      name: 'Post 01',
      type: 'light',
      maxCapacityHours: 12,
      today: {
        planHours: 8,
        factHours: 6,
        loadPercent: 75,
        efficiency: 85,
        workOrders: [{ id: 'wo1' }, { id: 'wo2' }],
        workers: [{ name: 'Worker A' }, { name: 'Worker B' }],
        workStats: { byGroup: [{ group: 'Oil change' }] },
        alerts: [{ id: 'a1' }],
      },
    },
    {
      id: 'post-2',
      name: 'Post 02',
      type: 'heavy',
      maxCapacityHours: 12,
      today: {
        planHours: 4,
        factHours: 2,
        loadPercent: 30,
        efficiency: 50,
        workOrders: [],
        workers: [],
        workStats: { byGroup: [] },
        alerts: [],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table headers', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('Post')).toBeInTheDocument();
    expect(screen.getByText('Plan / Fact / Idle')).toBeInTheDocument();
    expect(screen.getByText('postsDetail.load')).toBeInTheDocument();
    expect(screen.getByText('postsDetail.efficiency')).toBeInTheDocument();
    expect(screen.getByText('WO')).toBeInTheDocument();
    expect(screen.getByText('Workers')).toBeInTheDocument();
    expect(screen.getByText('Works')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('renders post rows', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('posts.post01')).toBeInTheDocument();
    expect(screen.getByText('posts.post02')).toBeInTheDocument();
  });

  it('shows post type badges', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('posts.light')).toBeInTheDocument();
    expect(screen.getByText('posts.heavy')).toBeInTheDocument();
  });

  it('click row navigates to post detail', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    const rows = screen.getAllByRole('row');
    // First data row (index 1, after header)
    fireEvent.click(rows[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/posts-detail?post=post-1');
  });

  it('shows work order count', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('2')).toBeInTheDocument(); // post-1 has 2 WOs
    expect(screen.getByText('0')).toBeInTheDocument(); // post-2 has 0 WOs
  });

  it('shows load percentage', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows efficiency percentage', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows worker names', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('Worker A')).toBeInTheDocument();
    expect(screen.getByText('Worker B')).toBeInTheDocument();
  });

  it('shows work types', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('Oil change')).toBeInTheDocument();
  });

  it('shows alert count badge', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('1')).toBeInTheDocument(); // post-1 has 1 alert
  });

  it('shows dash for empty workers and works', () => {
    render(<PostTableView posts={samplePosts} navigate={mockNavigate} />);
    // post-2 has no workers and no works — should show dashes
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
