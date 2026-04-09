import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Search, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-react';
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

export default function Audit() {
  const { t, i18n } = useTranslation();
  const { api, user } = useAuth();
  const isRu = i18n.language === 'ru';

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(25);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/api/audit-log').then(({ data }) => {
      if (data?.logs) {
        setLogs(data.logs);
        setTotal(data.total || data.logs.length);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = logs;
    if (filterAction) result = result.filter(l => l.action === filterAction);
    if (filterEntity) result = result.filter(l => l.entity === filterEntity);
    if (filterUser) result = result.filter(l => l.userName?.toLowerCase().includes(filterUser.toLowerCase()));
    if (dateFrom || dateTo) {
      result = result.filter(l => {
        const t = new Date(l.createdAt).getTime();
        if (dateFrom && t < new Date(dateFrom).getTime()) return false;
        if (dateTo && t > new Date(dateTo + 'T23:59:59').getTime()) return false;
        return true;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        l.userName?.toLowerCase().includes(s) ||
        l.entity?.toLowerCase().includes(s) ||
        l.entityId?.toLowerCase().includes(s) ||
        l.action?.toLowerCase().includes(s) ||
        l.newData?.toLowerCase().includes(s) ||
        l.oldData?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [logs, filterAction, filterEntity, filterUser, search, dateFrom, dateTo]);

  const paginated = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const uniqueEntities = [...new Set(logs.map(l => l.entity))];
  const uniqueUsers = [...new Set(logs.map(l => l.userName).filter(Boolean))];

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAction) params.set('action', filterAction);
      if (filterEntity) params.set('entity', filterEntity);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await api.get(`/api/audit-log/export-csv?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

  // Access control: admin only
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">{isRu ? 'Доступ запрещён' : 'Access denied'}</p>
      </div>
    );
  }

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatJson = (str) => {
    if (!str) return null;
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={22} style={{ color: 'var(--accent)' }} />
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('audit.title')}
        </h2>
        <HelpButton pageKey="audit" />
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
          {filtered.length} {isRu ? 'записей' : 'entries'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 350 }}>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder={isRu ? 'Поиск...' : 'Search...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">{isRu ? 'Все действия' : 'All actions'}</option>
          <option value="create">{ACTION_LABELS[isRu ? 'ru' : 'en'].create}</option>
          <option value="update">{ACTION_LABELS[isRu ? 'ru' : 'en'].update}</option>
          <option value="delete">{ACTION_LABELS[isRu ? 'ru' : 'en'].delete}</option>
        </select>
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">{isRu ? 'Все сущности' : 'All entities'}</option>
          {uniqueEntities.map(e => (
            <option key={e} value={e}>{ENTITY_LABELS[isRu ? 'ru' : 'en'][e] || e}</option>
          ))}
        </select>
        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(0); }}
          className="px-2 py-1.5 rounded-lg text-xs border outline-none"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">{isRu ? 'Все пользователи' : 'All users'}</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('audit.dateFrom')}</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="px-2 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('audit.dateTo')}</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="px-2 py-1.5 rounded-lg text-xs border outline-none"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all hover:opacity-80"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)', color: 'var(--text-primary)' }}>
          <Download size={14} />
          {t('audit.exportCsv')}
        </button>
      </div>

      {/* Table */}
      <div className="glass-static rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Время' : 'Time'}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пользователь' : 'User'}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Действие' : 'Action'}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Сущность' : 'Entity'}</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Загрузка...' : 'Loading...'}
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Нет записей' : 'No entries'}
                </td></tr>
              ) : paginated.map(log => (
                <tr key={log.id} className="cursor-pointer hover:opacity-80"
                  style={{ borderBottom: '1px solid var(--border-glass)' }}
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    {log.userName || '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: (ACTION_COLORS[log.action] || '#94a3b8') + '1a', color: ACTION_COLORS[log.action] || '#94a3b8' }}>
                      {ACTION_LABELS[isRu ? 'ru' : 'en'][log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>
                    {ENTITY_LABELS[isRu ? 'ru' : 'en'][log.entity] || log.entity}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {log.entityId || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {log.ip || '-'}
                  </td>
                </tr>
              ))}
              {/* Expanded detail row */}
              {paginated.map(log => expandedId === log.id && (
                <tr key={`${log.id}-detail`}>
                  <td colSpan={6} className="px-4 py-3" style={{ background: 'var(--bg-glass)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.oldData && (
                        <div>
                          <div className="text-xs font-medium mb-1" style={{ color: '#ef4444' }}>
                            {isRu ? 'Старые данные' : 'Old data'}
                          </div>
                          <pre className="text-xs p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', maxHeight: 200 }}>
                            {formatJson(log.oldData)}
                          </pre>
                        </div>
                      )}
                      {log.newData && (
                        <div>
                          <div className="text-xs font-medium mb-1" style={{ color: '#10b981' }}>
                            {isRu ? 'Новые данные' : 'New data'}
                          </div>
                          <pre className="text-xs p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', maxHeight: 200 }}>
                            {formatJson(log.newData)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border-glass)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {page * perPage + 1}-{Math.min((page + 1) * perPage, filtered.length)} {isRu ? 'из' : 'of'} {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:opacity-70"
                style={{ color: 'var(--text-secondary)' }}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--text-primary)' }}>{page + 1}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:opacity-70"
                style={{ color: 'var(--text-secondary)' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
