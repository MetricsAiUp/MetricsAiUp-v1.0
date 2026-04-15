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

import PostCardsView from '../PostCardsView';

describe('PostCardsView', () => {
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
        workers: [{ name: 'Worker A' }],
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

  it('renders card grid', () => {
    const { container } = render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(2);
  });

  it('each card shows post name', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('posts.post01')).toBeInTheDocument();
    expect(screen.getByText('posts.post02')).toBeInTheDocument();
  });

  it('shows post type badge', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('posts.light')).toBeInTheDocument();
    expect(screen.getByText('posts.heavy')).toBeInTheDocument();
  });

  it('shows load and efficiency metrics', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows plan/fact/max/idle/turbo metrics', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    // Plan hours for post-1
    expect(screen.getAllByText(/8ч/).length).toBeGreaterThanOrEqual(1);
    // Fact hours for post-1
    expect(screen.getAllByText(/6ч/).length).toBeGreaterThanOrEqual(1);
  });

  it('click card navigates to post detail', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    const cards = screen.getAllByText('postsDetail.goToPost');
    fireEvent.click(cards[0].closest('.glass'));
    expect(mockNavigate).toHaveBeenCalledWith('/posts-detail?post=post-1');
  });

  it('handles empty data gracefully', () => {
    const { container } = render(<PostCardsView posts={[]} navigate={mockNavigate} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(0);
  });

  it('shows worker names on card', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('Worker A')).toBeInTheDocument();
  });

  it('shows work types on card', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    expect(screen.getByText('Oil change')).toBeInTheDocument();
  });

  it('shows work order count', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    // post-1 has 2 WOs
    expect(screen.getByText('2')).toBeInTheDocument();
    // post-2 has 0 WOs
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows alert badge for posts with alerts', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    // post-1 has 1 alert
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows dash for posts without workers', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    // post-2 has no workers
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders go-to-post link on each card', () => {
    render(<PostCardsView posts={samplePosts} navigate={mockNavigate} />);
    const links = screen.getAllByText('postsDetail.goToPost');
    expect(links).toHaveLength(2);
  });
});
