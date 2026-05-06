import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle, Filter, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import HelpButton from '../components/HelpButton';

const TYPE_KEYS = ['no_show_in_cv', 'no_show_in_1c', 'wrong_post', 'overstated_norm_hours', 'understated_actual_time', 'time_mismatch'];
const SEVERITY_KEYS = ['critical', 'warning', 'info'];
const STATUS_KEYS = ['open', 'acknowledged', 'resolved', 'dismissed'];

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
  warning:  { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
  info:     { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
};

function formatDateTime(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

function KpiCard({ label, value, color }) {
  return (
    <div className="glass-static p-3 rounded-lg" style={{ minWidth: 140 }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function Pill({ children, color }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: color?.bg || 'var(--bg-glass)', color: color?.fg || 'var(--text-primary)' }}
    >
      {children}
    </span>
  );
}

function ExpandedDetail({ item, oneCOrder }) {
  const { t } = useTranslation();
  const oneC = (() => { try { return item.oneCValue ? JSON.parse(item.oneCValue) : null; } catch { return null; } })();
  const cv = (() => { try { return item.cvValue ? JSON.parse(item.cvValue) : null; } catch { return null; } })();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3" style={{ background: 'var(--bg-glass)' }}>
      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.oneCSection')}</div>
        {oneCOrder ? (
          <div className="space-y-1 text-xs">
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fNumber')}: </span><b>{oneCOrder.order_number}</b></div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fState')}: </span>{oneCOrder.state || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fPlate')}: </span>{oneCOrder.plate_number || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fVin')}: </span>{oneCOrder.vin || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fPlan')}: </span>{formatDateTime(oneCOrder.scheduled_start)} — {formatDateTime(oneCOrder.scheduled_end)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fClosed')}: </span>{formatDateTime(oneCOrder.closed_at)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fNorm')}: </span>{oneCOrder.norm_hours ?? '—'} {t('discrepancies.detail.fNormUnit')}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fExecutor')}: </span>{oneCOrder.executor || '—'}</div>
          </div>
        ) : oneC ? (
          <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{JSON.stringify(oneC, null, 2)}</pre>
        ) : (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.noOneC')}</div>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.cvSection')}</div>
        {item.vehicleSession ? (
          <div className="space-y-1 text-xs">
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fPlate')}: </span><b>{item.vehicleSession.plateNumber || '—'}</b></div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fEntry')}: </span>{formatDateTime(item.vehicleSession.entryTime)}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fExit')}: </span>{formatDateTime(item.vehicleSession.exitTime)}</div>
          </div>
        ) : null}
        {cv ? (
          <pre className="text-xs whitespace-pre-wrap mt-2" style={{ color: 'var(--text-secondary)' }}>{JSON.stringify(cv, null, 2)}</pre>
        ) : (item.vehicleSession ? null : (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.noCv')}</div>
        ))}
      </div>
    </div>
  );
}

export default function Discrepancies() {
  const { t } = useTranslation();
  const { api, hasPermission } = useAuth();
  const canManage = hasPermission && hasPermission('manage_discrepancies');

  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'open', severity: '', type: '', orderNumber: '' });
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});

  const loadStats = useCallback(async () => {
    const r = await api.get('/api/discrepancies/stats');
    setStats(r.data || null);
  }, [api]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ take: '100' });
    if (filters.status) params.set('status', filters.status);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.type) params.set('type', filters.type);
    if (filters.orderNumber) params.set('orderNumber', filters.orderNumber);
    const r = await api.get(`/api/discrepancies?${params.toString()}`);
    setItems(r.data?.items || []);
    setTotal(r.data?.total || 0);
    setLoading(false);
  }, [api, filters]);

  useEffect(() => { loadStats(); loadList(); /* eslint-disable-next-line */ }, [filters]);

  const toggleExpand = async (id) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
    if (!details[id]) {
      const r = await api.get(`/api/discrepancies/${id}`);
      if (r.data) setDetails((p) => ({ ...p, [id]: r.data }));
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const body = { status };
      if (status === 'resolved' || status === 'dismissed') {
        body.closeReason = status === 'resolved' ? 'manual_resolve' : 'manual_dismiss';
      }
      await api.patch(`/api/discrepancies/${id}/status`, body);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) {
      alert(t('data1c.common.error') + ': ' + e.message);
    }
  };

  const runDetect = async () => {
    if (!confirm(t('discrepancies.recomputeConfirm'))) return;
    try {
      await api.post('/api/discrepancies/run', { since: '7d' });
      await Promise.all([loadStats(), loadList()]);
    } catch (e) {
      alert(t('data1c.common.error') + ': ' + e.message);
    }
  };

  const byType = useMemo(() => {
    const map = {};
    (stats?.byType || []).forEach((t) => { map[t.type] = t.count; });
    return map;
  }, [stats]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
          {t('discrepancies.title')}
        </h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={runDetect}
              className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <RefreshCw size={14} /> {t('discrepancies.recompute')}
            </button>
          )}
          <HelpButton pageKey="discrepancies" />
        </div>
      </div>

      {/* KPI bar */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('discrepancies.kpi.total')} value={stats?.total ?? '—'} />
        <KpiCard label={t('discrepancies.kpi.open')} value={stats?.open ?? '—'} color="#f59e0b" />
        <KpiCard label={t('discrepancies.kpi.last24h')} value={stats?.newLast24h ?? '—'} />
        <KpiCard label={t('discrepancies.kpi.critical')} value={(stats?.bySeverity || []).find(s => s.severity === 'critical')?.count ?? 0} color="#ef4444" />
        <KpiCard label={t('discrepancies.kpi.warning')} value={(stats?.bySeverity || []).find(s => s.severity === 'warning')?.count ?? 0} color="#f59e0b" />
      </div>

      {/* By type cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {TYPE_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setFilters((p) => ({ ...p, type: p.type === key ? '' : key }))}
            className="glass-static p-2 rounded-lg text-left hover:opacity-80 transition-opacity"
            style={{ borderColor: filters.type === key ? 'var(--accent)' : 'transparent', border: '1px solid' }}
          >
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`discrepancies.type.${key}`)}</div>
            <div className="text-lg font-semibold mt-0.5">{byType[key] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-static p-3 rounded-lg flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Filter size={14} /> {t('discrepancies.filters.label')}
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="px-2 py-1 rounded text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('discrepancies.filters.allStatuses')}</option>
          {STATUS_KEYS.map((k) => <option key={k} value={k}>{t(`discrepancies.status.${k}`)}</option>)}
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}
          className="px-2 py-1 rounded text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('discrepancies.filters.allSeverities')}</option>
          {SEVERITY_KEYS.map((k) => <option key={k} value={k}>{t(`discrepancies.severity.${k}`)}</option>)}
        </select>
        <input
          placeholder={t('discrepancies.filters.orderNumber')}
          value={filters.orderNumber}
          onChange={(e) => setFilters((p) => ({ ...p, orderNumber: e.target.value }))}
          className="px-2 py-1 rounded text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.filters.found')}: {total}</span>
      </div>

      {/* Table */}
      <div className="glass-static rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-3 py-2" style={{ width: 32 }}></th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.type')}</th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.severity')}</th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.orderNumber')}</th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.description')}</th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.detectedAt')}</th>
              <th className="text-left px-3 py-2">{t('discrepancies.table.status')}</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.empty')}</td></tr>
            ) : items.flatMap((item) => {
              const rows = [
                <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleExpand(item.id)} aria-label="expand">
                      {expanded[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="px-3 py-2">{TYPE_KEYS.includes(item.type) ? t(`discrepancies.type.${item.type}`) : item.type}</td>
                  <td className="px-3 py-2"><Pill color={SEVERITY_COLORS[item.severity]}>{SEVERITY_KEYS.includes(item.severity) ? t(`discrepancies.severity.${item.severity}`) : item.severity}</Pill></td>
                  <td className="px-3 py-2 font-mono text-xs">{item.orderNumber || '—'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(item.detectedAt)}</td>
                  <td className="px-3 py-2"><Pill>{STATUS_KEYS.includes(item.status) ? t(`discrepancies.status.${item.status}`) : item.status}</Pill></td>
                  <td className="px-3 py-2">
                    {canManage && item.status === 'open' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(item.id, 'acknowledged')} title={t('discrepancies.table.actAcknowledge')}
                          className="p-1 rounded hover:opacity-70" style={{ color: '#3b82f6' }}><AlertCircle size={14} /></button>
                        <button onClick={() => updateStatus(item.id, 'resolved')} title={t('discrepancies.table.actResolve')}
                          className="p-1 rounded hover:opacity-70" style={{ color: '#10b981' }}><CheckCircle2 size={14} /></button>
                        <button onClick={() => updateStatus(item.id, 'dismissed')} title={t('discrepancies.table.actDismiss')}
                          className="p-1 rounded hover:opacity-70" style={{ color: '#64748b' }}><XCircle size={14} /></button>
                      </div>
                    )}
                    {canManage && item.status !== 'open' && (
                      <button onClick={() => updateStatus(item.id, 'open')} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.actReopen')}</button>
                    )}
                  </td>
                </tr>,
              ];
              if (expanded[item.id]) {
                const detail = details[item.id] || item;
                rows.push(
                  <tr key={item.id + '-detail'}>
                    <td colSpan={8} className="p-0">
                      <ExpandedDetail item={detail} oneCOrder={detail.oneCOrder} />
                    </td>
                  </tr>
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
