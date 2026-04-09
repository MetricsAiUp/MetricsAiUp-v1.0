import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Search, ChevronLeft, ChevronRight, Download, ChevronsLeft, ChevronsRight } from 'lucide-react';
import HelpButton from '../components/HelpButton';

const ACTION_COLORS = {
  create: '#10b981',
  update: '#3b82f6',
  delete: '#ef4444',
};

const ACTION_LABELS = {
  ru: { create: 'Создание', update: 'Изменение', delete: 'Удаление' },
  en: { create: 'Create', update: 'Update', delete: 'Delete' },
};

const ENTITY_LABELS = {
  ru: { user: 'Пользователь', zone: 'Зона', post: 'Пост', workOrder: 'Заказ-Наряд', session: 'Сессия', shift: 'Смена', camera: 'Камера', mapLayout: 'Карта' },
  en: { user: 'User', zone: 'Zone', post: 'Post', workOrder: 'Work Order', session: 'Session', shift: 'Shift', camera: 'Camera', mapLayout: 'Map Layout' },
};

const PER_PAGE_OPTIONS = [25, 50, 100];

export default function Audit() {
  const { t, i18n } = useTranslation();
  const { api, user } = useAuth();
  const isRu = i18n.language === 'ru';

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(perPage));
      params.set('offset', String(page * perPage));
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entity', filterEntity);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const { data } = await api.get(`/api/audit-log?${params.toString()}`);
      if (data?.logs) {
        setLogs(data.logs);
        setTotal(data.total || data.logs.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [api, page, perPage, filterAction, filterEntity, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Client-side search within current page (server doesn't support text search)
  const displayed = search
    ? logs.filter(l => {
        const s = search.toLowerCase();
        return (
          l.userName?.toLowerCase().includes(s) ||
          l.entity?.toLowerCase().includes(s) ||
          l.entityId?.toLowerCase().includes(s) ||
          l.action?.toLowerCase().includes(s)
        );
      })
    : logs;

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const goToPage = (p) => { setPage(Math.max(0, Math.min(p, totalPages - 1))); setExpandedId(null); };

  const handleFilterChange = (setter) => (e) => { setter(e.target.value); setPage(0); };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entity', filterEntity);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await api.get(`/api/audit-log/export-csv?${params.toString()}`);
      const blob = new Blob([typeof res.data === 'string' ? res.data : JSON.stringify(res.data)], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">{isRu ? 'Доступ запрещён' : 'Access denied'}</p>
      </div>
    );
  }

  const formatDate = (d) => new Date(d).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const formatJson = (str) => {
    if (!str) return null;
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
  };

  const rangeStart = page * perPage + 1;
  const rangeEnd = Math.min((page + 1) * perPage, total);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={20} style={{ color: 'var(--accent)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('audit.title')}
        </h2>
        <HelpButton pageKey="audit" />
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          {total} {isRu ? 'записей' : 'entries'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1" style={{ minWidth: 180, maxWidth: 300 }}>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRu ? 'Поиск...' : 'Search...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterAction} onChange={handleFilterChange(setFilterAction)}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">{isRu ? 'Все действия' : 'All actions'}</option>
          <option value="create">{ACTION_LABELS[isRu ? 'ru' : 'en'].create}</option>
          <option value="update">{ACTION_LABELS[isRu ? 'ru' : 'en'].update}</option>
          <option value="delete">{ACTION_LABELS[isRu ? 'ru' : 'en'].delete}</option>
        </select>
        <select value={filterEntity} onChange={handleFilterChange(setFilterEntity)}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">{isRu ? 'Все сущности' : 'All entities'}</option>
          {Object.entries(ENTITY_LABELS[isRu ? 'ru' : 'en']).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Дата от' : 'From'}</label>
          <input type="date" value={dateFrom} onChange={handleFilterChange(setDateFrom)}
            className="px-2 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Дата до' : 'To'}</label>
          <input type="date" value={dateTo} onChange={handleFilterChange(setDateTo)}
            className="px-2 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:opacity-80"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <Download size={13} />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Время' : 'Time'}</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пользователь' : 'User'}</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Действие' : 'Action'}</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Сущность' : 'Entity'}</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ID</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Загрузка...' : 'Loading...'}
                </td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Нет записей' : 'No entries'}
                </td></tr>
              ) : displayed.map(log => (
                <LogRow key={log.id} log={log} expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  isRu={isRu} formatDate={formatDate} formatJson={formatJson} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {total > 0 ? `${rangeStart}–${rangeEnd} ${isRu ? 'из' : 'of'} ${total}` : (isRu ? 'Нет записей' : 'No entries')}
            </span>
            <select value={perPage} onChange={e => { setPerPage(+e.target.value); setPage(0); }}
              className="px-1.5 py-0.5 rounded text-xs border outline-none"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
              {PER_PAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n} / {isRu ? 'стр' : 'page'}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => goToPage(0)} disabled={page === 0}
              className="p-1 rounded disabled:opacity-20 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}>
              <ChevronsLeft size={16} />
            </button>
            <button onClick={() => goToPage(page - 1)} disabled={page === 0}
              className="p-1 rounded disabled:opacity-20 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}>
              <ChevronLeft size={16} />
            </button>
            {/* Page numbers */}
            <PageNumbers current={page} total={totalPages} onGoTo={goToPage} />
            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1}
              className="p-1 rounded disabled:opacity-20 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => goToPage(totalPages - 1)} disabled={page >= totalPages - 1}
              className="p-1 rounded disabled:opacity-20 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}>
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Page number buttons */
function PageNumbers({ current, total, onGoTo }) {
  if (total <= 1) return null;
  const pages = [];
  const show = 5;
  let start = Math.max(0, current - Math.floor(show / 2));
  let end = Math.min(total, start + show);
  if (end - start < show) start = Math.max(0, end - show);

  for (let i = start; i < end; i++) pages.push(i);

  return (
    <div className="flex items-center gap-0.5 mx-1">
      {start > 0 && <span className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>...</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onGoTo(p)}
          className="min-w-[24px] h-6 rounded text-xs font-medium transition-all"
          style={{
            background: p === current ? 'var(--accent)' : 'transparent',
            color: p === current ? '#fff' : 'var(--text-secondary)',
          }}>
          {p + 1}
        </button>
      ))}
      {end < total && <span className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>...</span>}
    </div>
  );
}

/* Table row with expand */
function LogRow({ log, expanded, onToggle, isRu, formatDate, formatJson }) {
  return (
    <>
      <tr className="cursor-pointer hover:opacity-80 transition-opacity"
        style={{ borderBottom: '1px solid var(--border-glass)' }}
        onClick={onToggle}>
        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(log.createdAt)}
        </td>
        <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {log.userName || '—'}
        </td>
        <td className="px-3 py-2">
          <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: (ACTION_COLORS[log.action] || '#94a3b8') + '18', color: ACTION_COLORS[log.action] || '#94a3b8' }}>
            {ACTION_LABELS[isRu ? 'ru' : 'en'][log.action] || log.action}
          </span>
        </td>
        <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
          {ENTITY_LABELS[isRu ? 'ru' : 'en'][log.entity] || log.entity}
        </td>
        <td className="px-3 py-2 text-xs font-mono truncate" style={{ color: 'var(--text-muted)', maxWidth: 120 }}>
          {log.entityId ? log.entityId.slice(0, 8) + '...' : '—'}
        </td>
        <td className="px-3 py-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {log.ip || '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-3 py-3" style={{ background: 'var(--bg-glass)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {log.oldData && (
                <div>
                  <div className="text-[11px] font-medium mb-1" style={{ color: '#ef4444' }}>
                    {isRu ? 'Было' : 'Before'}
                  </div>
                  <pre className="text-[11px] p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', maxHeight: 160 }}>
                    {formatJson(log.oldData)}
                  </pre>
                </div>
              )}
              {log.newData && (
                <div>
                  <div className="text-[11px] font-medium mb-1" style={{ color: '#10b981' }}>
                    {isRu ? 'Стало' : 'After'}
                  </div>
                  <pre className="text-[11px] p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', maxHeight: 160 }}>
                    {formatJson(log.newData)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
