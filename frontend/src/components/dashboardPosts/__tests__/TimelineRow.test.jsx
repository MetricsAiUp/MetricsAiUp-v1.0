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
  };
});

vi.mock('../constants', () => ({
  POST_TYPE_ICONS: { light: () => <span data-testid="post-icon" />, heavy: () => <span data-testid="post-icon" /> },
  POST_STATUS_COLORS: {
    occupied: 'var(--danger)',
    free: 'var(--success)',
    unknown: 'var(--text-muted)',
  },
  STATUS_COLORS: {
    completed: { bg: 'var(--success)', text: '#fff' },
    in_progress: { bg: 'var(--accent)', text: '#fff' },
    scheduled: { bg: 'var(--text-muted)', text: '#fff' },
    overdue: { bg: 'var(--danger)', text: '#fff' },
  },
  getBlockStyle: (item, shiftStart, shiftEnd) => ({
    left: '10%',
    width: '20%',
  }),
  getItemStatus: () => 'scheduled',
}));

import TimelineRow from '../TimelineRow';

describe('TimelineRow', () => {
  const defaultPost = {
    id: 'post-1',
    name: 'Post 01',
    type: 'light',
    status: 'free',
    currentVehicle: null,
    timeline: [
      {
        id: 'wo-1',
        workOrderNumber: 'WO-001',
        workType: 'Oil change',
        startTime: '2026-04-14T09:00:00Z',
        endTime: '2026-04-14T11:00:00Z',
        estimatedEnd: '2026-04-14T11:00:00Z',
        normHours: 2,
        status: 'scheduled',
      },
    ],
  };

  const defaultProps = {
    post: defaultPost,
    shiftStart: '08:00',
    shiftEnd: '20:00',
    onBlockClick: vi.fn(),
    onDrop: vi.fn(),
    dragOverPostId: null,
    conflictItemIds: new Set(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders post name', () => {
    render(<TimelineRow {...defaultProps} />);
    expect(screen.getByText('posts.post01')).toBeInTheDocument();
  });

  it('shows free status when no current vehicle', () => {
    render(<TimelineRow {...defaultProps} />);
    expect(screen.getByText('posts.free')).toBeInTheDocument();
  });

  it('shows work order blocks', () => {
    render(<TimelineRow {...defaultProps} />);
    expect(screen.getByText('WO-001')).toBeInTheDocument();
  });

  it('shows vehicle info when post is occupied', () => {
    const occupiedPost = {
      ...defaultPost,
      status: 'occupied',
      currentVehicle: { plateNumber: 'A123BC', brand: 'Toyota', model: 'Camry' },
    };
    render(<TimelineRow {...defaultProps} post={occupiedPost} />);
    expect(screen.getByText('A123BC')).toBeInTheDocument();
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
  });

  it('block click calls onBlockClick', () => {
    render(<TimelineRow {...defaultProps} />);
    const block = screen.getByText('WO-001');
    fireEvent.click(block.closest('[draggable]'));
    expect(defaultProps.onBlockClick).toHaveBeenCalledWith(
      defaultPost.timeline[0],
      defaultPost
    );
  });

  it('blocks are draggable', () => {
    render(<TimelineRow {...defaultProps} />);
    const block = screen.getByText('WO-001').closest('[draggable]');
    expect(block).toHaveAttribute('draggable', 'true');
  });

  it('shows post type badge', () => {
    render(<TimelineRow {...defaultProps} />);
    expect(screen.getByText('posts.light')).toBeInTheDocument();
  });

  it('applies drop target outline when dragging over', () => {
    const { container } = render(
      <TimelineRow {...defaultProps} dragOverPostId="post-1" />
    );
    const timeline = container.querySelector('.flex-1.relative');
    expect(timeline).toHaveStyle({ outline: '2px dashed var(--accent)' });
  });

  it('highlights conflict items', () => {
    const conflictSet = new Set(['wo-1']);
    const { container } = render(
      <TimelineRow {...defaultProps} conflictItemIds={conflictSet} />
    );
    const block = screen.getByText('WO-001').closest('[draggable]');
    expect(block).toHaveStyle({ outline: '2px solid var(--danger)' });
  });
});
