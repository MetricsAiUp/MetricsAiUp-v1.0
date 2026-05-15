import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RepairKindChips from '../RepairKindChips';

describe('RepairKindChips', () => {
  it('renders dot when kinds empty', () => {
    const { container } = render(<RepairKindChips kinds={[]} />);
    expect(container.textContent).toContain('·');
  });

  it('renders dot when kinds is null', () => {
    const { container } = render(<RepairKindChips kinds={null} />);
    expect(container.textContent).toContain('·');
  });

  it('renders each kind with its count', () => {
    const kinds = [
      { kind: 'ТО', count: 3 },
      { kind: 'Шиномонтаж', count: 1 },
    ];
    const { container } = render(<RepairKindChips kinds={kinds} />);
    expect(container.textContent).toContain('ТО');
    expect(container.textContent).toContain('×3');
    expect(container.textContent).toContain('Шиномонтаж');
    expect(container.textContent).toContain('×1');
  });

  it('sorts kinds by count DESC', () => {
    const kinds = [
      { kind: 'A', count: 1 },
      { kind: 'B', count: 5 },
      { kind: 'C', count: 3 },
    ];
    const { container } = render(<RepairKindChips kinds={kinds} />);
    const text = container.textContent;
    expect(text.indexOf('B')).toBeLessThan(text.indexOf('C'));
    expect(text.indexOf('C')).toBeLessThan(text.indexOf('A'));
  });

  it('shows +N overflow chip when count exceeds max', () => {
    const kinds = Array.from({ length: 10 }, (_, i) => ({ kind: `K${i}`, count: 10 - i }));
    const { container } = render(<RepairKindChips kinds={kinds} max={3} />);
    expect(container.textContent).toContain('+7');
  });

  it('puts hidden kinds list into title of overflow chip', () => {
    const kinds = [
      { kind: 'A', count: 5 },
      { kind: 'B', count: 4 },
      { kind: 'C', count: 3 },
      { kind: 'D', count: 2 },
    ];
    const { container } = render(<RepairKindChips kinds={kinds} max={2} />);
    const overflow = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '+2');
    expect(overflow).toBeTruthy();
    expect(overflow.getAttribute('title')).toContain('C ×3');
    expect(overflow.getAttribute('title')).toContain('D ×2');
  });
});
