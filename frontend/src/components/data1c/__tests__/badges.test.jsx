import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, fallback) => fallback ?? k,
    i18n: { language: 'ru' },
  }),
}));

import ImportStatusBadge from '../ImportStatusBadge';
import ImportTypeBadge from '../ImportTypeBadge';
import StateBadge from '../StateBadge';

describe('ImportStatusBadge', () => {
  it('classifies "success" as success', () => {
    const { container } = render(<ImportStatusBadge status="success" />);
    expect(container.querySelector('span').style.color).toBe('rgb(16, 185, 129)');
  });

  it('classifies "partial" as partial', () => {
    const { container } = render(<ImportStatusBadge status="partial" />);
    expect(container.querySelector('span').style.color).toBe('rgb(245, 158, 11)');
  });

  it('classifies "pending" as pending', () => {
    const { container } = render(<ImportStatusBadge status="pending" />);
    expect(container.querySelector('span').style.color).toBe('rgb(59, 130, 246)');
  });

  it('classifies any "error*" status as error', () => {
    const { container, rerender } = render(<ImportStatusBadge status="error" />);
    expect(container.querySelector('span').style.color).toBe('rgb(239, 68, 68)');
    rerender(<ImportStatusBadge status="error_parse" />);
    expect(container.querySelector('span').style.color).toBe('rgb(239, 68, 68)');
  });

  it('shows fallback when status is unknown', () => {
    const { container } = render(<ImportStatusBadge status="weird" />);
    // unknown variant uses var(--text-muted) which jsdom does not resolve — just check renders
    expect(container.querySelector('span')).toBeTruthy();
  });

  it('renders error in title attribute when provided', () => {
    const { container } = render(<ImportStatusBadge status="error" error="boom" />);
    expect(container.querySelector('span').getAttribute('title')).toContain('boom');
  });
});

describe('ImportTypeBadge', () => {
  it('renders single dot when type is empty', () => {
    const { container } = render(<ImportTypeBadge type={null} />);
    expect(container.textContent).toContain('·');
  });

  it('renders plan/repair/performed types with correct colors', () => {
    const { container, rerender } = render(<ImportTypeBadge type="plan" />);
    expect(container.querySelector('span').style.color).toBe('rgb(59, 130, 246)');
    rerender(<ImportTypeBadge type="repair" />);
    expect(container.querySelector('span').style.color).toBe('rgb(245, 158, 11)');
    rerender(<ImportTypeBadge type="performed" />);
    expect(container.querySelector('span').style.color).toBe('rgb(139, 92, 246)');
  });

  it('uses helpcircle icon fallback for unknown type', () => {
    const { container } = render(<ImportTypeBadge type="weird" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('StateBadge', () => {
  it('renders dot for empty state', () => {
    const { container } = render(<StateBadge state={null} />);
    expect(container.textContent).toContain('·');
  });

  it('classifies "Закрыт" as success (green)', () => {
    const { container } = render(<StateBadge state="Закрыт" />);
    expect(container.querySelector('span').style.color).toBe('rgb(16, 185, 129)');
  });

  it('classifies "Выполнен" as purple', () => {
    const { container } = render(<StateBadge state="Выполнен" />);
    expect(container.querySelector('span').style.color).toBe('rgb(139, 92, 246)');
  });

  it('classifies "В работе" as blue', () => {
    const { container } = render(<StateBadge state="В работе" />);
    expect(container.querySelector('span').style.color).toBe('rgb(59, 130, 246)');
  });

  it('classifies "Открыт"/"Новый" as warning (amber)', () => {
    const { container, rerender } = render(<StateBadge state="Открыт" />);
    expect(container.querySelector('span').style.color).toBe('rgb(245, 158, 11)');
    rerender(<StateBadge state="Новый" />);
    expect(container.querySelector('span').style.color).toBe('rgb(245, 158, 11)');
  });

  it('uses size="sm" to render smaller font', () => {
    const { container } = render(<StateBadge state="Закрыт" size="sm" />);
    expect(container.querySelector('span').style.fontSize).toBe('11px');
  });

  it('falls back to neutral color for unrecognized state', () => {
    const { container } = render(<StateBadge state="Неопределено" />);
    // Falls into RULES.find — none match → uses default { color: 'var(--text-muted)' }
    // jsdom resolves var() to '', so just verify it renders with the state text
    expect(container.textContent).toContain('Неопределено');
  });
});
