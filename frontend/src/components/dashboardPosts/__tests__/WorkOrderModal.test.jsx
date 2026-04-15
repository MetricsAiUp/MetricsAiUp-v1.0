import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../constants', () => ({
  STATUS_COLORS: {
    completed: { bg: 'var(--success)', text: '#fff' },
    in_progress: { bg: 'var(--accent)', text: '#fff' },
    scheduled: { bg: 'var(--text-muted)', text: '#fff' },
    overdue: { bg: 'var(--danger)', text: '#fff' },
  },
  formatTime: (t) => t ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '\u2014',
}));

vi.mock('../../PostTimer', () => ({
  default: () => <div data-testid="post-timer">Timer</div>,
}));

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Clock: icon,
    Car: icon,
    Wrench: icon,
    AlertTriangle: icon,
    X: icon,
    User: icon,
    FileText: icon,
    Timer: icon,
    Package: icon,
    CreditCard: icon,
  };
});

import WorkOrderModal from '../WorkOrderModal';

describe('WorkOrderModal', () => {
  const mockT = (k) => k;
  const defaultItem = {
    id: 'wo-1',
    workOrderNumber: 'WO-2026-001',
    plateNumber: 'A123BC77',
    brand: 'Toyota',
    model: 'Camry',
    workType: 'Oil change',
    startTime: '2026-04-14T09:00:00Z',
    endTime: '2026-04-14T11:00:00Z',
    estimatedEnd: '2026-04-14T11:00:00Z',
    normHours: 2,
    actualHours: 1.8,
    status: 'completed',
    master: 'Ivan Petrov',
    worker: 'Sergey Sidorov',
    note: null,
  };

  const defaultPost = {
    id: 'post-1',
    name: 'Post 05',
  };

  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders work order number', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('WO-2026-001')).toBeInTheDocument();
  });

  it('renders plate number', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('A123BC77')).toBeInTheDocument();
  });

  it('renders work type', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('Oil change')).toBeInTheDocument();
  });

  it('shows norm hours', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('2 dashboardPosts.hours')).toBeInTheDocument();
  });

  it('shows actual hours', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('1.8 dashboardPosts.hours')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('workOrders.completed')).toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    // Click backdrop
    const backdrop = screen.getByText('WO-2026-001').closest('.fixed');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows brand and model', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
  });

  it('shows master name', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
  });

  it('shows worker name', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('Sergey Sidorov')).toBeInTheDocument();
  });

  it('shows post name', () => {
    render(<WorkOrderModal item={defaultItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByText('posts.post05')).toBeInTheDocument();
  });

  it('returns null when item is null', () => {
    const { container } = render(<WorkOrderModal item={null} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows timer for in-progress items', () => {
    const inProgressItem = { ...defaultItem, status: 'in_progress' };
    render(<WorkOrderModal item={inProgressItem} post={defaultPost} onClose={onClose} t={mockT} />);
    expect(screen.getByTestId('post-timer')).toBeInTheDocument();
  });

  it('does not show actual hours if not provided', () => {
    const noActual = { ...defaultItem, actualHours: null };
    render(<WorkOrderModal item={noActual} post={defaultPost} onClose={onClose} t={mockT} />);
    // Only norm hours should appear
    expect(screen.getByText('2 dashboardPosts.hours')).toBeInTheDocument();
    expect(screen.queryByText('1.8 dashboardPosts.hours')).not.toBeInTheDocument();
  });
});
