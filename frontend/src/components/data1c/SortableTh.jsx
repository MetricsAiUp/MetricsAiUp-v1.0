// Кликабельный заголовок таблицы с индикатором сортировки.
// Использование:
//   <SortableTh sortKey="name" current={sortKey} dir={sortDir} onToggle={toggle}>Имя</SortableTh>

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export default function SortableTh({ sortKey, current, dir, onToggle, children, align = 'left', className = '' }) {
  const isActive = current === sortKey;
  const sortable = !!sortKey && !!onToggle;

  return (
    <th
      onClick={sortable ? () => onToggle(sortKey) : undefined}
      className={`px-3 py-2 text-${align} text-xs uppercase tracking-wide select-none ${sortable ? 'cursor-pointer' : ''} ${className}`}
      style={{
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          isActive
            ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
            : <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
        )}
      </span>
    </th>
  );
}
