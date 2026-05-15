import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, fb) => fb ?? k, i18n: { language: 'ru' } }),
}));

import MetricRow from '../MetricRow';
import ResourceBar from '../ResourceBar';
import StatusBadge from '../StatusBadge';

describe('MetricRow', () => {
  it('renders label and value', () => {
    render(<MetricRow label="CPU" value="12%" />);
    expect(screen.getByText('CPU')).toBeTruthy();
    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('applies custom color to value', () => {
    const { container } = render(<MetricRow label="X" value="9" color="#ef4444" />);
    const spans = container.querySelectorAll('span');
    expect(spans[1].style.color).toBe('rgb(239, 68, 68)');
  });
});

describe('ResourceBar', () => {
  it('clamps percent to 0..100', () => {
    const { container, rerender } = render(<ResourceBar label="X" percent={-10} />);
    expect(container.textContent).toContain('0%');
    rerender(<ResourceBar label="X" percent={150} />);
    expect(container.textContent).toContain('100%');
  });

  it('shows the percent label', () => {
    render(<ResourceBar label="Disk" percent={42} />);
    expect(screen.getByText('Disk')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('uses green color when below warn threshold', () => {
    const { container } = render(<ResourceBar label="X" percent={50} />);
    // Find the inner colored fill bar
    const fills = container.querySelectorAll('div[style*="background"]');
    const greenBar = Array.from(fills).find((d) => d.style.background.includes('rgb(16, 185, 129)'));
    expect(greenBar).toBeTruthy();
  });

  it('uses red color at >= 95%', () => {
    const { container } = render(<ResourceBar label="X" percent={97} />);
    const fills = container.querySelectorAll('div[style*="background"]');
    const redBar = Array.from(fills).find((d) => d.style.background.includes('rgb(239, 68, 68)'));
    expect(redBar).toBeTruthy();
  });

  it('renders hint when provided', () => {
    render(<ResourceBar label="X" percent={10} hint="свободно 9 ГБ" />);
    expect(screen.getByText('свободно 9 ГБ')).toBeTruthy();
  });
});

describe('StatusBadge', () => {
  it('renders translated label for ok status', () => {
    const { container } = render(<StatusBadge status="ok" />);
    expect(container.textContent.toLowerCase()).toContain('ok');
  });

  it('uses level override when supplied', () => {
    const { container } = render(<StatusBadge status="ok" level="critical" />);
    const span = container.querySelector('span');
    expect(span.style.color).toBe('rgb(239, 68, 68)');
  });

  it('accepts custom label override', () => {
    render(<StatusBadge status="ok" label="Всё хорошо" />);
    expect(screen.getByText('Всё хорошо')).toBeTruthy();
  });

  it('renders the colored dot indicator', () => {
    const { container } = render(<StatusBadge status="critical" />);
    const dot = container.querySelector('span > span');
    expect(dot.style.background).toBe('rgb(239, 68, 68)');
  });
});
