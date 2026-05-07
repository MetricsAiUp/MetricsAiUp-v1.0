// Унифицированная панель фильтров: период + поиск + слот для доп.фильтров + счётчик + кнопки.
//
// props:
//   period:        { preset, from, to }
//   onPeriodChange:(period) => void
//   periodLabel?:  заголовок над периодом (например, "По дате получения")
//   search?:       string
//   onSearchChange?:(q) => void
//   searchPlaceholder?: string
//   children:      произвольные доп. фильтры (dropdown'ы и т.п.)
//   onRefresh?:    () => void
//   onReset?:      () => void   // если задан — кнопка "Сброс"
//   info?:         текст справа (например, "Найдено: 42 из 1666")
//   showPeriod?:   true по умолчанию

import { Search, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PeriodPresets from './PeriodPresets';

export default function FilterBar({
  period, onPeriodChange, periodLabel,
  search, onSearchChange, searchPlaceholder,
  children,
  onRefresh, onReset, info,
  showPeriod = true,
  loading = false,
}) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-glass)',
      }}
    >
      {/* Верхняя строка: период + поиск */}
      <div className="flex items-center gap-3 flex-wrap">
        {showPeriod && period && onPeriodChange && (
          <div className="flex items-center gap-2 flex-wrap">
            {periodLabel && (
              <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {periodLabel}
              </span>
            )}
            <PeriodPresets value={period} onChange={onPeriodChange} />
          </div>
        )}
        {onSearchChange && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px] relative">
            <Search size={14} style={{ color: 'var(--text-muted)', position: 'absolute', left: 10, pointerEvents: 'none' }} />
            <input
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || t('common.search')}
              className="w-full pl-8 pr-2 py-1.5 rounded-md text-sm outline-none"
              style={{
                background: 'var(--bg-glass)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
              }}
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 p-0.5 rounded hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
                title={t('common.clear')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Нижняя строка: доп.фильтры + кнопки + info */}
      {(children || onRefresh || onReset || info) && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {info && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{info}</span>}
            {onReset && (
              <button
                onClick={onReset}
                className="px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition-colors"
                style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}
              >
                <X size={12} /> {t('common.reset')}
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition-colors"
                style={{ background: 'var(--accent)', color: 'white' }}
                title={t('data1c.common.refresh')}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {t('data1c.common.refresh')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
