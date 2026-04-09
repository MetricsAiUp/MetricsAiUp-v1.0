import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import SparkLine from '../SparkLine';

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children, ...props }) => <div data-testid="responsive-container" {...props}>{children}</div>,
  LineChart: ({ children, ...props }) => <div data-testid="line-chart">{children}</div>,
  Line: (props) => <div data-testid="line" />,
}));

describe('SparkLine', () => {
  it('renders nothing when data is empty', () => {
    const { container } = render(<SparkLine data={[]} dataKey="value" color="#000" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is null', () => {
    const { container } = render(<SparkLine data={null} dataKey="value" color="#000" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when data is undefined', () => {
    const { container } = render(<SparkLine dataKey="value" color="#000" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when valid data provided', () => {
    const data = [{ value: 10 }, { value: 20 }, { value: 30 }];
    const { getByTestId } = render(<SparkLine data={data} dataKey="value" color="#10b981" />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
    expect(getByTestId('line-chart')).toBeInTheDocument();
  });
});
