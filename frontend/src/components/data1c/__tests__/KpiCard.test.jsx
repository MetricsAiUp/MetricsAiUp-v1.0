import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckCircle2 } from 'lucide-react';
import KpiCard from '../KpiCard';

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Импорты" value={42} />);
    expect(screen.getByText('Импорты')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders hint when provided', () => {
    render(<KpiCard label="X" value={1} hint="за 7 дней" />);
    expect(screen.getByText('за 7 дней')).toBeTruthy();
  });

  it('is disabled when no onClick provided', () => {
    render(<KpiCard label="X" value={1} />);
    const btn = screen.getByRole('button');
    expect(btn.disabled).toBe(true);
  });

  it('is clickable when onClick provided', () => {
    const onClick = vi.fn();
    render(<KpiCard label="X" value={1} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies "active" styling via inline style border color', () => {
    const { container } = render(<KpiCard label="X" value={1} tone="success" active onClick={() => {}} />);
    const btn = container.querySelector('button');
    expect(btn.style.border).toContain('rgb(16, 185, 129)'); // success color (jsdom normalizes hex → rgb)
  });

  it('renders icon when provided', () => {
    const { container } = render(<KpiCard label="X" value={1} icon={CheckCircle2} />);
    // lucide icons render as <svg> with class
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('falls back to default tone for unknown tone value', () => {
    render(<KpiCard label="X" value={1} tone="totally-unknown" />);
    expect(screen.getByText('X')).toBeTruthy();
  });
});
