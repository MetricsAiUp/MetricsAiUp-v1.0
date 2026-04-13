import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Universal Pagination component.
 *
 * @param {number} page          - Current page (1-indexed)
 * @param {number} totalPages    - Total number of pages
 * @param {number} totalItems    - Total number of items
 * @param {number} perPage       - Items per page
 * @param {number[]} perPageOptions - Options for perPage selector
 * @param {function} onPageChange    - (page: number) => void  (1-indexed)
 * @param {function} onPerPageChange - (perPage: number) => void
 * @param {boolean} compact      - Compact mode: "page X / Y" instead of page numbers
 * @param {boolean} showPerPage  - Show perPage selector (default true)
 */
export default function Pagination({
  page, totalPages, totalItems, perPage,
  perPageOptions = [10, 20, 50, 100],
  onPageChange, onPerPageChange,
  compact = false,
  showPerPage = true,
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  if (totalPages <= 1 && !showPerPage) return null;

  const from = totalItems > 0 ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, totalItems);

  // Generate page numbers with ellipsis
  const pageNumbers = [];
  if (!compact) {
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
        pageNumbers.push(i);
      } else if (pageNumbers[pageNumbers.length - 1] !== '...') {
        pageNumbers.push('...');
      }
    }
  }

  const btnCls = 'p-1 rounded-lg text-xs disabled:cursor-default transition-opacity';
  const btnStyle = (disabled) => ({
    background: 'var(--bg-glass)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* Left: info + perPage */}
      <div className="flex items-center gap-2">
        {showPerPage && onPerPageChange && (
          <>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Строк на странице:' : 'Rows per page:'}
            </span>
            <select
              value={perPage}
              onChange={(e) => {
                onPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 rounded-lg text-xs outline-none cursor-pointer"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            >
              {perPageOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </>
        )}
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {totalItems > 0 ? `${from}–${to} ${isRu ? 'из' : 'of'} ${totalItems}` : (isRu ? 'Нет записей' : 'No entries')}
        </span>
      </div>

      {/* Right: navigation */}
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page <= 1}
          className={btnCls} style={btnStyle(page <= 1)}>
          <ChevronsLeft size={16} />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className={btnCls} style={btnStyle(page <= 1)}>
          <ChevronLeft size={16} />
        </button>

        {compact ? (
          <span className="text-xs px-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            {page} / {totalPages}
          </span>
        ) : (
          pageNumbers.map((p, i) =>
            p === '...' ? (
              <span key={`dot-${i}`} className="px-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                ...
              </span>
            ) : (
              <button key={p} onClick={() => onPageChange(p)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: page === p ? 'var(--accent)' : 'var(--bg-glass)',
                  color: page === p ? 'white' : 'var(--text-muted)',
                }}>
                {p}
              </button>
            )
          )
        )}

        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className={btnCls} style={btnStyle(page >= totalPages)}>
          <ChevronRight size={16} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
          className={btnCls} style={btnStyle(page >= totalPages)}>
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
