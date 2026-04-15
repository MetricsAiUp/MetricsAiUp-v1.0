import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonBox, SkeletonText, DashboardSkeleton, TableSkeleton } from '../Skeleton';

describe('SkeletonBox', () => {
  it('renders with custom width and height', () => {
    const { container } = render(<SkeletonBox w={200} h={40} />);
    const box = container.firstChild;
    expect(box).toHaveStyle({ width: '200px', height: '40px' });
  });

  it('has skeleton class', () => {
    const { container } = render(<SkeletonBox w={100} h={20} />);
    expect(container.firstChild).toHaveClass('skeleton');
  });

  it('applies additional className', () => {
    const { container } = render(<SkeletonBox w={100} h={20} className="custom-class" />);
    expect(container.firstChild).toHaveClass('skeleton');
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('SkeletonText', () => {
  it('renders given number of lines', () => {
    const { container } = render(<SkeletonText lines={5} />);
    const lines = container.querySelectorAll('.skeleton');
    expect(lines).toHaveLength(5);
  });

  it('defaults to 3 lines', () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll('.skeleton');
    expect(lines).toHaveLength(3);
  });

  it('last line has 60% width', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.querySelectorAll('.skeleton');
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toHaveStyle({ width: '60%' });
  });

  it('non-last lines have 100% width', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.querySelectorAll('.skeleton');
    expect(lines[0]).toHaveStyle({ width: '100%' });
    expect(lines[1]).toHaveStyle({ width: '100%' });
  });

  it('all lines have skeleton class for animation', () => {
    const { container } = render(<SkeletonText lines={2} />);
    const lines = container.querySelectorAll('.skeleton');
    lines.forEach((line) => {
      expect(line).toHaveClass('skeleton');
    });
  });
});

describe('DashboardSkeleton', () => {
  it('renders card placeholders', () => {
    const { container } = render(<DashboardSkeleton />);
    // 4 KPI cards in the grid
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(4);
  });

  it('has animate-pulse class', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders skeleton elements', () => {
    const { container } = render(<DashboardSkeleton />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('TableSkeleton', () => {
  it('renders default 5 rows', () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll('.border-t');
    expect(rows).toHaveLength(5);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />);
    const rows = container.querySelectorAll('.border-t');
    expect(rows).toHaveLength(3);
  });

  it('renders header row with column placeholders', () => {
    const { container } = render(<TableSkeleton rows={2} cols={4} />);
    // Header is the first flex container inside the first child
    const header = container.querySelector('.flex.gap-4');
    expect(header).toBeInTheDocument();
    expect(header.querySelectorAll('.skeleton')).toHaveLength(4);
  });

  it('renders skeleton elements with animation class', () => {
    const { container } = render(<TableSkeleton />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('has rounded border container', () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstChild).toHaveClass('rounded-xl');
  });
});
