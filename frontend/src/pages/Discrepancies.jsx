import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle, AlertCircle, CheckCircle2, XCircle, RefreshCw,
  ChevronDown, ChevronRight, ListChecks, Inbox, Clock, Flame,
  EyeOff, MapPinOff, Timer, TimerOff, Hourglass, RotateCcw,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import KpiCard from '../components/data1c/KpiCard';
import FilterBar from '../components/data1c/FilterBar';

const TYPE_KEYS = ['no_show_in_cv', 'no_show_in_1c', 'wrong_post', 'overstated_norm_hours', 'understated_actual_time', 'time_mismatch'];
const SEVERITY_KEYS = ['critical', 'warning', 'info'];
const STATUS_KEYS = ['open', 'acknowledged', 'resolved', 'dismissed'];

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444', border: 'rgba(239,68,68,0.35)' },
  warning:  { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', border: 'rgba(245,158,11,0.35)' },
  info:     { bg: 'rgba(59,130,246,0.14)', fg: '#3b82f6', border: 'rgba(59,130,246,0.35)' },
};

const STATUS_COLORS = {
  open:         { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', border: 'rgba(245,158,11,0.35)' },
  acknowledged: { bg: 'rgba(59,130,246,0.14)', fg: '#3b82f6', border: 'rgba(59,130,246,0.35)' },
  resolved:     { bg: 'rgba(16,185,129,0.14)', fg: '#10b981', border: 'rgba(16,185,129,0.35)' },
  dismissed:    { bg: 'rgba(100,116,139,0.16)', fg: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
};

const TYPE_ICON = {
  no_show_in_cv:           EyeOff,
  no_show_in_1c:           Inbox,
  wrong_post:              MapPinOff,
  overstated_norm_hours:   Hourglass,
  understated_actual_time: TimerOff,
  time_mismatch:           Timer,
};

function formatDateTime(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

function Pill({ children, color }) {
  const c = color || { bg: 'var(--bg-glass)', fg: 'var(--text-secondary)', border: 'var(--border-glass)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border || 'transparent'}` }}
    >
      {children}
    </span>
  );
}

function tdStyle(idx) {
  return { background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' };
}

function ExpandedDetail({ item, oneCOrder }) {
  const { t } = useTranslation();
  const oneC = (() => { try { return item.oneCValue ? JSON.parse(item.oneCValue) : null; } catch { return null; } })();
  const cv = (() => { try { return item.cvValue ? JSON.parse(item.cvValue) : null; } catch { return null; } })();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4" style={{ background: 'rgba(0,0,0,0.10)' }}>
      <div>
        <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{t('discrepancies.detail.oneCSection')}</div>
        {oneCOrder ? (
          <div className="space-y-1 text-xs">
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fNumber')}: </span><b className="font-mono">{oneCOrder.order_number}</b></div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fState')}: </span>{oneCOrder.state || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fPlate')}: </span>{oneCOrder.plate_number || '—'}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>{t('discrepancies.detail.fVin')}: </span><span className="font-mono">{oneCOrder.vin || '—'}</span></div>
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
        <div className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{t('discrepancies.detail.cvSection')}</div>
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
  const [filters, setFilters] = useState({ status: 'open', severity: '', type: '', orderNumber: '', search: '' });
  const [period, setPeriod] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});

  const loadStats = useCallback(async () => {
    const r = await api.get('/api/discrepancies/stats');
    setStats(r.data || null);
  }, [api]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      take: String(perPage),
      skip: String((page - 1) * perPage),
    });
    if (filters.status) params.set('status', filters.status);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.type) params.set('type', filters.type);
    if (filters.orderNumber) params.set('orderNumber', filters.orderNumber);
    if (period.from) params.set('from', period.from);
    if (period.to) params.set('to', period.to);
    const r = await api.get(`/api/discrepancies?${params.toString()}`);
    setItems(r.data?.items || []);
    setTotal(r.data?.total || 0);
    setLoading(false);
  }, [api, filters.status, filters.severity, filters.type, filters.orderNumber, period.from, period.to, page, perPage]);

  useEffect(() => { loadStats(); loadList(); }, [loadStats, loadList]);

  // Reset to first page when filters/period change (but not when page itself changes)
  useEffect(() => { setPage(1); }, [filters.status, filters.severity, filters.type, filters.orderNumber, period.preset, period.from, period.to, perPage]);

  const visibleItems = useMemo(() => {
    if (!filters.search) return items;
    const q = filters.search.toLowerCase();
    return items.filter((it) => {
      if ((it.description || '').toLowerCase().includes(q)) return true;
      if ((it.orderNumber || '').toLowerCase().includes(q)) return true;
      const plate = it.vehicleSession?.plateNumber || '';
      if (plate.toLowerCase().includes(q)) return true;
      try {
        const o = it.oneCValue ? JSON.parse(it.oneCValue) : null;
        if (o?.vin && String(o.vin).toLowerCase().includes(q)) return true;
        if (o?.plate_number && String(o.plate_number).toLowerCase().includes(q)) return true;
      } catch { /* ignore */ }
      return false;
    });
  }, [items, filters.search]);

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

  const onReset = () => {
    setFilters({ status: 'open', severity: '', type: '', orderNumber: '', search: '' });
    setPeriod({ preset: 'all', from: null, to: null });
  };
  const hasFilters = !!filters.severity || !!filters.type || !!filters.orderNumber || !!filters.search || filters.status !== 'open' || period.preset !== 'all';

  const byType = useMemo(() => {
    const map = {};
    (stats?.byType || []).forEach((row) => { map[row.type] = row.count; });
    return map;
  }, [stats]);

  const criticalCount = (stats?.bySeverity || []).find((s) => s.severity === 'critical')?.count ?? 0;
  const warningCount  = (stats?.bySeverity || []).find((s) => s.severity === 'warning')?.count ?? 0;

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-sm font-bold flex items-center gap-1.5 whitespace-nowrap pr-3"
            style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-glass)' }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
          {t('discrepancies.title')}
        </h1>
        <div className="flex flex-wrap gap-2 flex-1">
          <KpiCard label={t('discrepancies.kpi.total')}    value={stats?.total ?? '—'}      icon={ListChecks}    tone="default" />
          <KpiCard label={t('discrepancies.kpi.open')}     value={stats?.open ?? '—'}       icon={Inbox}         tone="warning"
                   onClick={() => setFilters((p) => ({ ...p, status: p.status === 'open' ? '' : 'open' }))} active={filters.status === 'open'} />
          <KpiCard label={t('discrepancies.kpi.last24h')}  value={stats?.newLast24h ?? '—'} icon={Clock}         tone="info" />
          <KpiCard label={t('discrepancies.kpi.critical')} value={criticalCount}            icon={Flame}         tone="danger"
                   onClick={() => setFilters((p) => ({ ...p, severity: p.severity === 'critical' ? '' : 'critical' }))} active={filters.severity === 'critical'} />
          <KpiCard label={t('discrepancies.kpi.warning')}  value={warningCount}             icon={AlertTriangle} tone="warning"
                   onClick={() => setFilters((p) => ({ ...p, severity: p.severity === 'warning' ? '' : 'warning' }))} active={filters.severity === 'warning'} />
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={runDetect}
              className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <RefreshCw size={14} /> {t('discrepancies.recompute')}
            </button>
          )}
          <HelpButton pageKey="discrepancies" />
        </div>
      </div>

      {/* By type — chips */}
      <div className="rounded-xl p-3 flex flex-col gap-2"
           style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {t('discrepancies.byTypeTitle')}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {TYPE_KEYS.map((key) => {
            const Icon = TYPE_ICON[key] || AlertCircle;
            const active = filters.type === key;
            const count = byType[key] ?? 0;
            const isHot = count > 0;
            const accent = isHot ? '#ef4444' : 'var(--text-muted)';
            return (
              <button
                key={key}
                onClick={() => setFilters((p) => ({ ...p, type: p.type === key ? '' : key }))}
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all text-left"
                style={{
                  background: active ? `${accent}1A` : 'rgba(0,0,0,0.10)',
                  border: `1px solid ${active ? accent : 'var(--border-glass)'}`,
                  boxShadow: active ? `0 0 0 1px ${accent}30` : 'none',
                }}
                title={t(`discrepancies.type.${key}`)}
              >
                <div className="rounded-md p-1.5 flex items-center justify-center"
                     style={{ background: `${accent}1F`, color: accent }}>
                  <Icon size={14} />
                </div>
                <div className="flex flex-col leading-tight min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wide truncate"
                        style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {t(`discrepancies.type.${key}`)}
                  </span>
                  <span className="text-base font-bold" style={{ color: isHot ? accent : 'var(--text-primary)' }}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        period={period}
        onPeriodChange={setPeriod}
        periodLabel={t('discrepancies.table.detectedAt')}
        search={filters.search}
        onSearchChange={(v) => setFilters((p) => ({ ...p, search: v }))}
        searchPlaceholder={t('discrepancies.filters.searchPlaceholder')}
        onRefresh={() => { loadStats(); loadList(); }}
        onReset={hasFilters ? onReset : null}
        info={`${t('discrepancies.filters.found')}: ${total}`}
        loading={loading}
      >
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('discrepancies.filters.allStatuses')}</option>
          {STATUS_KEYS.map((k) => <option key={k} value={k}>{t(`discrepancies.status.${k}`)}</option>)}
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('discrepancies.filters.allSeverities')}</option>
          {SEVERITY_KEYS.map((k) => <option key={k} value={k}>{t(`discrepancies.severity.${k}`)}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('discrepancies.filters.allTypes')}</option>
          {TYPE_KEYS.map((k) => <option key={k} value={k}>{t(`discrepancies.type.${k}`)}</option>)}
        </select>
        <input
          placeholder={t('discrepancies.filters.orderNumber')}
          value={filters.orderNumber}
          onChange={(e) => setFilters((p) => ({ ...p, orderNumber: e.target.value }))}
          className="px-2 py-1 rounded-md text-sm font-mono"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', maxWidth: 160 }}
        />
      </FilterBar>

      {/* Table */}
      <div className="rounded-xl overflow-hidden"
           style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th className="text-left px-3 py-2 font-semibold" style={{ width: 32, color: 'var(--text-muted)' }}></th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.type')}</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.severity')}</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.orderNumber')}</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.description')}</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.detectedAt')}</th>
                <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.status')}</th>
                <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('discrepancies.table.loading')}</td></tr>
              ) : visibleItems.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 size={28} style={{ color: '#10b981', opacity: 0.5 }} />
                    <span>{t('discrepancies.table.empty')}</span>
                  </div>
                </td></tr>
              ) : visibleItems.flatMap((item, idx) => {
                const TypeIcon = TYPE_ICON[item.type] || AlertCircle;
                const severityColor = SEVERITY_COLORS[item.severity];
                const statusColor = STATUS_COLORS[item.status];
                const rows = [
                  <tr key={item.id} className="transition-colors hover:bg-[var(--bg-glass-hover)] border-t"
                      style={{ ...tdStyle(idx), borderColor: 'var(--border-glass)' }}>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleExpand(item.id)} aria-label="expand"
                              className="p-1 rounded hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                        {expanded[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md p-1 flex items-center justify-center"
                             style={{ background: severityColor?.bg, color: severityColor?.fg }}>
                          <TypeIcon size={12} />
                        </div>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {TYPE_KEYS.includes(item.type) ? t(`discrepancies.type.${item.type}`) : item.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Pill color={severityColor}>{SEVERITY_KEYS.includes(item.severity) ? t(`discrepancies.severity.${item.severity}`) : item.severity}</Pill>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{item.orderNumber || <span style={{ opacity: 0.4 }}>·</span>}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDateTime(item.detectedAt)}</td>
                    <td className="px-3 py-2"><Pill color={statusColor}>{STATUS_KEYS.includes(item.status) ? t(`discrepancies.status.${item.status}`) : item.status}</Pill></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canManage && item.status === 'open' && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => updateStatus(item.id, 'acknowledged')} title={t('discrepancies.table.actAcknowledge')}
                            className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                            <AlertCircle size={13} />
                          </button>
                          <button onClick={() => updateStatus(item.id, 'resolved')} title={t('discrepancies.table.actResolve')}
                            className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <CheckCircle2 size={13} />
                          </button>
                          <button onClick={() => updateStatus(item.id, 'dismissed')} title={t('discrepancies.table.actDismiss')}
                            className="p-1.5 rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: 'rgba(100,116,139,0.14)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }}>
                            <XCircle size={13} />
                          </button>
                        </div>
                      )}
                      {canManage && item.status !== 'open' && (
                        <button onClick={() => updateStatus(item.id, 'open')}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:opacity-80 transition-opacity"
                          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
                          title={t('discrepancies.table.actReopen')}>
                          <RotateCcw size={11} /> {t('discrepancies.table.actReopen')}
                        </button>
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
        {total > 0 && (
          <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / perPage))}
              totalItems={total}
              perPage={perPage}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              perPageOptions={[10, 20, 50, 100]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
