// Универсальный хук сортировки массива по колонке.
// Использование:
//   const { sorted, sortKey, sortDir, toggle } = useTableSort(items, 'name', 'asc');
//   <SortableTh sortKey="name" current={sortKey} dir={sortDir} onToggle={toggle}>Имя</SortableTh>

import { useMemo, useState, useCallback } from 'react';

function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;  // пустые в конец
  if (b == null) return -1;
  // числа
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  // даты — ISO-строки сортируются лексикографически корректно, но если это Date — приведём
  if (a instanceof Date || b instanceof Date) {
    const av = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const bv = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return av - bv;
  }
  // строки
  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
}

export default function useTableSort(items, defaultKey = null, defaultDir = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir); // 'asc' | 'desc'

  const toggle = useCallback((key) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        // тот же ключ — переключаем направление
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      // другой ключ — ставим desc по умолчанию (новые/большие сверху)
      setSortDir('desc');
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !Array.isArray(items)) return items || [];
    const arr = [...items];
    arr.sort((a, b) => {
      const av = typeof sortKey === 'function' ? sortKey(a) : a[sortKey];
      const bv = typeof sortKey === 'function' ? sortKey(b) : b[sortKey];
      const cmp = compare(av, bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle, setSortKey, setSortDir };
}
