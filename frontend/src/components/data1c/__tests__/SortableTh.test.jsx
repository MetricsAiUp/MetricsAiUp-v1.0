import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SortableTh from '../SortableTh';

function inTable(node) {
  return (<table><thead><tr>{node}</tr></thead></table>);
}

describe('SortableTh', () => {
  it('renders title children', () => {
    const { getByText } = render(inTable(<SortableTh sortKey="name" current={null} dir="asc" onToggle={() => {}}>Имя</SortableTh>));
    expect(getByText('Имя')).toBeTruthy();
  });

  it('calls onToggle(sortKey) when clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(inTable(<SortableTh sortKey="name" current={null} dir="asc" onToggle={onToggle}>Имя</SortableTh>));
    fireEvent.click(container.querySelector('th'));
    expect(onToggle).toHaveBeenCalledWith('name');
  });

  it('renders ChevronUp when active and dir=asc', () => {
    const { container } = render(inTable(<SortableTh sortKey="name" current="name" dir="asc" onToggle={() => {}}>X</SortableTh>));
    // lucide-react ChevronUp has class lucide-chevron-up
    expect(container.querySelector('.lucide-chevron-up')).toBeTruthy();
  });

  it('renders ChevronDown when active and dir=desc', () => {
    const { container } = render(inTable(<SortableTh sortKey="name" current="name" dir="desc" onToggle={() => {}}>X</SortableTh>));
    expect(container.querySelector('.lucide-chevron-down')).toBeTruthy();
  });

  it('renders ChevronsUpDown when inactive', () => {
    const { container } = render(inTable(<SortableTh sortKey="name" current="other" dir="asc" onToggle={() => {}}>X</SortableTh>));
    expect(container.querySelector('.lucide-chevrons-up-down')).toBeTruthy();
  });

  it('is not sortable when no sortKey or onToggle', () => {
    const onToggle = vi.fn();
    const { container } = render(inTable(<SortableTh current="x" dir="asc">Plain</SortableTh>));
    fireEvent.click(container.querySelector('th'));
    expect(onToggle).not.toHaveBeenCalled();
    // No sort indicator should be rendered (no svg)
    expect(container.querySelector('svg')).toBeFalsy();
  });

  it('applies "text-right" alignment class when align="right"', () => {
    const { container } = render(inTable(<SortableTh sortKey="x" current="x" dir="asc" onToggle={() => {}} align="right">X</SortableTh>));
    expect(container.querySelector('th').className).toContain('text-right');
  });
});
