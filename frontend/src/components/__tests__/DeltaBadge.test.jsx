import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DeltaBadge from '../DeltaBadge';

describe('DeltaBadge', () => {
  it('returns null for null value', () => {
    const { container } = render(<DeltaBadge value={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for undefined value', () => {
    const { container } = render(<DeltaBadge value={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for NaN value', () => {
    const { container } = render(<DeltaBadge value={NaN} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows up arrow and green color for positive values', () => {
    const { container } = render(<DeltaBadge value={5.3} />);
    const span = container.querySelector('span');
    expect(span.textContent).toContain('\u2191');
    expect(span.textContent).toContain('5.3%');
    expect(span.style.color).toBe('rgb(16, 185, 129)');
  });

  it('shows down arrow and red color for negative values', () => {
    const { container } = render(<DeltaBadge value={-3.7} />);
    const span = container.querySelector('span');
    expect(span.textContent).toContain('\u2193');
    expect(span.textContent).toContain('3.7%');
    expect(span.style.color).toBe('rgb(239, 68, 68)');
  });

  it('shows correct suffix', () => {
    const { container } = render(<DeltaBadge value={2.0} suffix="pts" />);
    const span = container.querySelector('span');
    expect(span.textContent).toContain('2.0pts');
  });

  it('uses default suffix %', () => {
    const { container } = render(<DeltaBadge value={1.5} />);
    const span = container.querySelector('span');
    expect(span.textContent).toContain('1.5%');
  });

  it('shows gray for zero value', () => {
    const { container } = render(<DeltaBadge value={0} />);
    const span = container.querySelector('span');
    expect(span.style.color).toBe('rgb(148, 163, 184)');
    expect(span.textContent).toBe('0.0%');
  });

  it('inverse mode reverses colors - positive value shows red', () => {
    const { container } = render(<DeltaBadge value={5} inverse={true} />);
    const span = container.querySelector('span');
    // positive value + inverse = not positive = red
    expect(span.style.color).toBe('rgb(239, 68, 68)');
  });

  it('inverse mode reverses colors - negative value shows green', () => {
    const { container } = render(<DeltaBadge value={-5} inverse={true} />);
    const span = container.querySelector('span');
    // negative value + inverse = positive = green
    expect(span.style.color).toBe('rgb(16, 185, 129)');
  });
});
