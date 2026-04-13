import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import DateRangePicker from '../components/DateRangePicker';

export default function WorkOrders() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('scheduledTime');
  const [sortDir, setSortDir] = useState('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetchOrders = () => {
    api.get('/api/work-orders')
      .then(res => setOrders(res.data.orders || []))
      .catch(console.error);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleImport = async () => {
    try {
      await api.post('/api/work-orders/import-csv', { csvData: csvText });
      setCsvText('');
      setShowImport(false);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const statusColors = {
    scheduled: 'var(--info)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
    cancelled: 'var(--text-muted)',
    no_show: 'var(--danger)',
  };

  const uniqueStatuses = [...new Set(orders.map(o => o.status))];

  const filtered = useMemo(() => {
    return orders
      .filter(o => statusFilter === 'all' || o.status === statusFilter)
      .filter(o => {
        if (!dateFrom && !dateTo) return true;
        const t = new Date(o.scheduledTime).getTime();
        if (dateFrom && t < new Date(dateFrom).getTime()) return false;
        if (dateTo && t > new Date(dateTo + 'T23:59:59').getTime()) return false;
        return true;
      })
      .filter(o => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (o.orderNumber || '').toLowerCase().includes(q) ||
          (o.plateNumber || '').toLowerCase().includes(q) ||
          (o.workType || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        let va, vb;
        if (sortBy === 'scheduledTime') {
          va = new Date(a.scheduledTime).getTime();
          vb = new Date(b.scheduledTime).getTime();
        } else if (sortBy === 'orderNumber') {
          va = a.orderNumber || '';
          vb = b.orderNumber || '';
        } else if (sortBy === 'plateNumber') {
          va = a.plateNumber || '';
          vb = b.plateNumber || '';
        } else if (sortBy === 'normHours') {
          va = a.normHours || 0;
          vb = b.normHours || 0;
        } else if (sortBy === 'status') {
          va = a.status || '';
          vb = b.status || '';
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [orders, statusFilter, search, sortBy, sortDir, dateFrom, dateTo]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const columns = [
    { key: 'orderNumber', label: t('workOrders.orderNumber') },
    { key: 'scheduledTime', label: t('workOrders.scheduledTime') },
    { key: 'plateNumber', label: t('workOrders.plateNumber') },
    { key: 'workType', label: t('workOrders.workType'), noSort: true },
    { key: 'normHours', label: t('workOrders.normHours') },
    { key: 'status', label: t('workOrders.status') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('workOrders.title')}
          </h2>
          <HelpButton pageKey="workOrders" />
        </div>
        <button onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          {t('workOrders.importCsv')}
        </button>
      </div>

      {showImport && (
        <div className="glass p-4 space-y-3">
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
            placeholder="order_number,date,plate_number,work_type,norm_hours" rows={5}
            className="w-full p-3 rounded-xl text-sm font-mono outline-none"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
          <div className="flex gap-2">
            <button onClick={handleImport} className="px-4 py-2 rounded-xl text-sm text-white" style={{ background: 'var(--success)' }}>
              {t('common.save')}
            </button>
            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isRu ? 'Поиск по номеру ЗН, авто, типу работ...' : 'Search by WO number, plate, work type...'}
          className="px-4 py-2 rounded-xl text-sm outline-none flex-1 min-w-[200px]"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} ns="workOrders" />
        <div className="flex gap-1.5">
          <button onClick={() => setStatusFilter('all')}
            className="px-3 py-1.5 rounded-lg text-xs" style={{
              background: statusFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
              color: statusFilter === 'all' ? 'white' : 'var(--text-muted)',
            }}>{isRu ? 'Все' : 'All'}</button>
          {uniqueStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs" style={{
                background: statusFilter === s ? 'var(--accent)' : 'var(--bg-glass)',
                color: statusFilter === s ? 'white' : 'var(--text-muted)',
              }}>{t(`workOrders.${s}`)}</button>
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} / {orders.length}</span>
      </div>

      {/* Table */}
      <div className="glass-static overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              {columns.map(col => (
                <th key={col.key}
                  className={`text-left px-4 py-3 font-medium ${col.noSort ? '' : 'cursor-pointer select-none hover:opacity-80'}`}
                  style={{ color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)' }}
                  onClick={() => !col.noSort && toggleSort(col.key)}>
                  {col.label}{!col.noSort && sortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(wo => (
              <tr key={wo.id} className="hover:opacity-80 transition-opacity" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <td className="px-4 py-3 font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{wo.orderNumber}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{new Date(wo.scheduledTime).toLocaleString()}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.plateNumber || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.workType || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{wo.normHours || '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs"
                    style={{ background: (statusColors[wo.status] || 'var(--text-muted)') + '22', color: statusColors[wo.status] }}>
                    {t(`workOrders.${wo.status}`)}
                  </span>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
    </div>
  );
}
