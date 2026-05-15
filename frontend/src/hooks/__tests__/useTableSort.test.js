import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTableSort from '../useTableSort';

describe('useTableSort', () => {
  it('returns items unchanged when no sortKey set', () => {
    const items = [{ name: 'B' }, { name: 'A' }];
    const { result } = renderHook(() => useTableSort(items));
    expect(result.current.sorted).toEqual(items);
    expect(result.current.sortKey).toBeNull();
  });

  it('sorts strings via Russian locale (RU + numeric collation)', () => {
    const items = [{ name: 'Пост 10' }, { name: 'Пост 2' }, { name: 'Пост 1' }];
    const { result } = renderHook(() => useTableSort(items, 'name', 'asc'));
    expect(result.current.sorted.map((x) => x.name)).toEqual(['Пост 1', 'Пост 2', 'Пост 10']);
  });

  it('sorts numbers ascending and descending', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const { result } = renderHook(() => useTableSort(items, 'n', 'asc'));
    expect(result.current.sorted.map((x) => x.n)).toEqual([1, 2, 3]);
    act(() => { result.current.setSortDir('desc'); });
    expect(result.current.sorted.map((x) => x.n)).toEqual([3, 2, 1]);
  });

  it('places nulls at the end regardless of direction', () => {
    const items = [{ n: 1 }, { n: null }, { n: 3 }];
    const { result } = renderHook(() => useTableSort(items, 'n', 'asc'));
    const order = result.current.sorted.map((x) => x.n);
    expect(order[order.length - 1]).toBeNull();
  });

  it('sorts Date values by timestamp', () => {
    const items = [
      { d: new Date('2026-04-14T10:00:00Z') },
      { d: new Date('2026-04-14T08:00:00Z') },
      { d: new Date('2026-04-14T09:00:00Z') },
    ];
    const { result } = renderHook(() => useTableSort(items, 'd', 'asc'));
    expect(result.current.sorted.map((x) => x.d.toISOString())).toEqual([
      '2026-04-14T08:00:00.000Z',
      '2026-04-14T09:00:00.000Z',
      '2026-04-14T10:00:00.000Z',
    ]);
  });

  it('accepts function accessor when set via setSortKey', () => {
    const items = [{ user: { age: 30 } }, { user: { age: 20 } }];
    const accessor = (x) => x.user.age;
    const { result } = renderHook(() => useTableSort(items));
    act(() => { result.current.setSortKey(() => accessor); result.current.setSortDir('asc'); });
    expect(result.current.sorted.map((x) => x.user.age)).toEqual([20, 30]);
  });

  it('toggle flips direction when called with the same key', () => {
    const items = [{ n: 1 }, { n: 2 }];
    const { result } = renderHook(() => useTableSort(items, 'n', 'desc'));
    expect(result.current.sortDir).toBe('desc');
    act(() => { result.current.toggle('n'); });
    expect(result.current.sortDir).toBe('asc');
    act(() => { result.current.toggle('n'); });
    expect(result.current.sortDir).toBe('desc');
  });

  it('toggle resets to desc when switching to a new key', () => {
    const items = [{ a: 1, b: 1 }];
    const { result } = renderHook(() => useTableSort(items, 'a', 'asc'));
    act(() => { result.current.toggle('b'); });
    expect(result.current.sortKey).toBe('b');
    expect(result.current.sortDir).toBe('desc');
  });

  it('returns empty array when items is not an array', () => {
    const { result } = renderHook(() => useTableSort(null, 'x', 'asc'));
    expect(result.current.sorted).toEqual([]);
  });

  it('exposes setSortKey / setSortDir setters', () => {
    const items = [{ n: 1 }];
    const { result } = renderHook(() => useTableSort(items));
    act(() => { result.current.setSortKey('n'); result.current.setSortDir('asc'); });
    expect(result.current.sortKey).toBe('n');
    expect(result.current.sortDir).toBe('asc');
  });
});
