// Данные 1С — экран на 6 вкладок (Сейчас / Импорты / Сырые таблицы / Несопоставленные / Выработка / Настройки).
// Под капотом — REST /api/oneC/*.
//
// Редизайн: KPI-карточки, унифицированный FilterBar (период + поиск + доп.фильтры),
// сортируемые колонки, цветные бейджи состояний и типов, chips для видов работ,
// бейджи-счётчики на самих табах.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Database, Inbox, AlertTriangle, BarChart3, Settings, Upload, RefreshCw, Save,
  CheckCircle2, XCircle, Layers, Activity, Hourglass, ListChecks, Hash, Users, Mail, Server, FilterX,
  BellOff, Bell,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import FilterBar from '../components/data1c/FilterBar';
import PeriodPresets from '../components/data1c/PeriodPresets';
import SortableTh from '../components/data1c/SortableTh';
import StateBadge from '../components/data1c/StateBadge';
import ImportTypeBadge from '../components/data1c/ImportTypeBadge';
import ImportStatusBadge from '../components/data1c/ImportStatusBadge';
import KpiCard from '../components/data1c/KpiCard';
import RepairKindChips from '../components/data1c/RepairKindChips';
import useTableSort from '../hooks/useTableSort';

const TAB_DEFS = [
  { id: 'current',  icon: Database,       perm: 'view_1c' },
  { id: 'imports',  icon: Inbox,          perm: 'view_1c' },
  { id: 'raw',      icon: Layers,         perm: 'view_1c' },
  { id: 'unmapped', icon: AlertTriangle,  perm: 'manage_1c_import' },
  { id: 'payroll',  icon: BarChart3,      perm: 'view_1c' },
  { id: 'settings', icon: Settings,       perm: 'manage_1c_config' },
];

// ---------- helpers ----------
function fmtDt(s) {
  if (!s) return null;
  try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(s); }
}

function fmtDtRel(s) {
  if (!s) return null;
  try {
    const d = new Date(s);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const isYest = d.toDateString() === yest.toDateString();
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `сегодня, ${time}`;
    if (isYest) return `вчера, ${time}`;
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return String(s); }
}

function Dash() { return <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>·</span>; }

// Базовая обёртка для строк таблицы — zebra + hover.
function tdStyle(idx) {
  return {
    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
  };
}

const TR_CLASS = 'transition-colors hover:bg-[var(--bg-glass-hover)]';

// Универсальный wrapper для таблицы — общий каркас.
function TableShell({ children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}

// Применить период к массиву по полю.
function inPeriod(value, period) {
  if (!period || period.preset === 'all' || (!period.from && !period.to)) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  if (period.from && t < new Date(period.from).getTime()) return false;
  if (period.to && t > new Date(period.to).getTime()) return false;
  return true;
}

// ---------- Tab: Current ----------
function TabCurrent({ api }) {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [period, setPeriod] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/oneC/current?take=50000');
      setAllItems(r.data?.items || []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, stateFilter, period.preset, period.from, period.to]);

  // Список уникальных состояний для dropdown'а
  const stateOptions = useMemo(() => {
    const set = new Set();
    for (const r of allItems) if (r.state) set.add(r.state);
    return [...set].sort();
  }, [allItems]);

  // Фильтрация
  const filtered = useMemo(() => {
    let res = allItems;
    if (stateFilter) res = res.filter((r) => r.state === stateFilter);
    if (period.preset !== 'all') {
      res = res.filter((r) => inPeriod(r.scheduled_start, period));
    }
    if (search) {
      const q = search.toLowerCase();
      res = res.filter((r) =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.vin || '').toLowerCase().includes(q) ||
        (r.plate_number || '').toLowerCase().includes(q) ||
        (r.executor || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [allItems, stateFilter, period, search]);

  // KPI
  const kpi = useMemo(() => {
    const inWork = allItems.filter((r) => /работ/i.test(r.state || '')).length;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const closedToday = allItems.filter((r) => r.closed_at && new Date(r.closed_at) >= startOfToday).length;
    const now = Date.now();
    const overdue = allItems.filter((r) =>
      /работ/i.test(r.state || '') && r.scheduled_start && new Date(r.scheduled_start).getTime() < now - 12 * 3600 * 1000
    ).length;
    return { total: allItems.length, inWork, closedToday, overdue };
  }, [allItems]);

  // Сортировка — снимаем подсказки из ключей API (snake_case).
  const { sorted, sortKey, sortDir, toggle } = useTableSort(filtered, null, 'desc');

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const items = sorted.slice((page - 1) * perPage, page * perPage);

  const onReset = () => {
    setSearch(''); setStateFilter(''); setPeriod({ preset: 'all', from: null, to: null });
  };
  const hasFilters = !!search || !!stateFilter || period.preset !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('data1c.kpi.current.total')}       value={kpi.total}       icon={Hash}        tone="default" />
        <KpiCard label={t('data1c.kpi.current.inWork')}      value={kpi.inWork}      icon={Activity}    tone="info"      onClick={() => setStateFilter(stateOptions.find((s) => /работ/i.test(s)) || '')} active={stateFilter && /работ/i.test(stateFilter)} />
        <KpiCard label={t('data1c.kpi.current.closedToday')} value={kpi.closedToday} icon={CheckCircle2} tone="success" />
        <KpiCard label={t('data1c.kpi.current.overdue')}     value={kpi.overdue}     icon={Hourglass}   tone="danger" />
      </div>

      <FilterBar
        period={period} onPeriodChange={setPeriod} periodLabel={t('data1c.filterByPlan')}
        search={search} onSearchChange={setSearch} searchPlaceholder={t('data1c.current.searchPlaceholder')}
        onRefresh={load} onReset={hasFilters ? onReset : null}
        info={t('data1c.found', { shown: filtered.length, total: allItems.length })}
        loading={loading}
      >
        <select
          value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        >
          <option value="">{t('data1c.anyState')}</option>
          {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FilterBar>

      <TableShell>
        <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <SortableTh sortKey="order_number" current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colNumber')}</SortableTh>
            <SortableTh sortKey="plate_number" current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colPlate')}</SortableTh>
            <SortableTh sortKey="vin"          current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colVin')}</SortableTh>
            <SortableTh sortKey="state"        current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colState')}</SortableTh>
            <SortableTh sortKey="scheduled_start" current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colPlan')}</SortableTh>
            <SortableTh sortKey="closed_at"    current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colClosed')}</SortableTh>
            <SortableTh sortKey="norm_hours"   current={sortKey} dir={sortDir} onToggle={toggle} align="right">{t('data1c.current.colNorm')}</SortableTh>
            <SortableTh sortKey="executor"     current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.current.colExecutor')}</SortableTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
          ) : items.map((r, idx) => (
            <tr key={r.id} className={TR_CLASS} style={{ ...tdStyle(idx), borderTop: '1px solid var(--border-glass)' }}>
              <td className="px-3 py-2 font-mono text-xs">{r.order_number || <Dash />}</td>
              <td className="px-3 py-2 font-medium">{r.plate_number || <Dash />}</td>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.vin || <Dash />}</td>
              <td className="px-3 py-2"><StateBadge state={r.state} /></td>
              <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDtRel(r.scheduled_start) || <Dash />}</td>
              <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDtRel(r.closed_at) || <Dash />}</td>
              <td className="px-3 py-2 text-right font-mono">{r.norm_hours != null ? r.norm_hours : <Dash />}</td>
              <td className="px-3 py-2 truncate max-w-[260px]" title={r.executor}>{r.executor || <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination
        page={page} totalPages={totalPages} totalItems={sorted.length}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Imports ----------
function TabImports({ api, canImport }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [forceType, setForceType] = useState('');
  const [period, setPeriod] = useState({ preset: 'week', ...(() => {
    const now = new Date();
    const w = new Date(now); w.setDate(w.getDate() - 6); w.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,999);
    return { from: w.toISOString(), to: e.toISOString() };
  })() });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * perPage;
      const params = new URLSearchParams({ take: String(perPage), skip: String(skip) });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('detectedType', typeFilter);
      if (search) params.set('q', search);
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
      const r = await api.get(`/api/oneC/imports?${params.toString()}`);
      setItems(r.data?.items || []);
      setTotal(r.data?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [api, page, perPage, statusFilter, typeFilter, search, period.from, period.to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, search, period.preset, period.from, period.to]);

  // KPI считаем по текущей странице — показываем как «по выборке».
  // Для агрегатов запрашивать всё было бы накладно: для индикации этого хватает.
  const kpi = useMemo(() => {
    const success = items.filter((r) => r.status === 'success').length;
    const errors = items.filter((r) => (r.status || '').startsWith('error')).length;
    const rowsTotal = items.reduce((s, r) => s + (r.rowsInserted || 0), 0);
    return { totalPeriod: total, success, errors, rowsTotal };
  }, [items, total]);

  // Сортировка по текущей странице
  const { sorted, sortKey, sortDir, toggle } = useTableSort(items, 'receivedAt', 'desc');

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const data = btoa(bin);
    try {
      const r = await api.post('/api/oneC/imports/upload', { filename: file.name, data, forceType: forceType || undefined });
      toast.success(`${t('data1c.imports.uploaded')}: ${file.name} — ${t('data1c.imports.type')}: ${r.data?.detected || forceType || '—'}, ${t('data1c.imports.rows')}: ${r.data?.inserted ?? '—'}`);
      e.target.value = '';
      await load();
    } catch (err) {
      toast.error(t('data1c.common.error') + ': ' + err.message);
    }
  };

  const onRun = async () => {
    setRunning(true);
    try {
      const r = await api.post('/api/oneC/imports/run', {});
      toast.success(t('data1c.imports.imapCycleResult', { count: r.data?.fetched ?? 0 }));
      await load();
    } catch (err) {
      toast.error(t('data1c.common.error') + ': ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const onAcknowledge = async (id, currentlyAcked) => {
    try {
      const url = currentlyAcked
        ? `/api/oneC/imports/${id}/unacknowledge`
        : `/api/oneC/imports/${id}/acknowledge`;
      await api.post(url, {});
      toast.success(t(currentlyAcked ? 'data1c.imports.unacknowledged' : 'data1c.imports.acknowledged'));
      await load();
    } catch (e) {
      toast.error(t('data1c.common.error') + ': ' + e.message);
    }
  };

  const onReset = () => {
    setStatusFilter(''); setTypeFilter(''); setSearch(''); setPeriod({ preset: 'all', from: null, to: null });
  };
  const hasFilters = !!statusFilter || !!typeFilter || !!search || period.preset !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('data1c.kpi.imports.totalPeriod')} value={kpi.totalPeriod} icon={Mail}        tone="default" />
        <KpiCard label={t('data1c.kpi.imports.success')}     value={kpi.success}     icon={CheckCircle2} tone="success" hint={t('common.page') + ' ' + page} />
        <KpiCard label={t('data1c.kpi.imports.errors')}      value={kpi.errors}      icon={XCircle}     tone="danger" hint={t('common.page') + ' ' + page} />
        <KpiCard label={t('data1c.kpi.imports.rowsTotal')}   value={kpi.rowsTotal}   icon={ListChecks}  tone="accent" hint={t('common.page') + ' ' + page} />
      </div>

      {canImport && (
        <div className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <select value={forceType} onChange={(e) => setForceType(e.target.value)}
            className="px-2 py-1.5 rounded-md text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <option value="">{t('data1c.imports.autoDetectType')}</option>
            <option value="plan">plan</option>
            <option value="repair">repair</option>
            <option value="performed">performed</option>
          </select>
          <label className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <Upload size={14} /> {t('data1c.imports.uploadXlsx')}
            <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" />
          </label>
          <button onClick={onRun} disabled={running}
            className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {t('data1c.imports.imapCycle')}
          </button>
        </div>
      )}

      <FilterBar
        period={period} onPeriodChange={setPeriod} periodLabel={t('data1c.filterByReceived')}
        search={search} onSearchChange={setSearch} searchPlaceholder={t('data1c.imports.searchPlaceholder')}
        onRefresh={load} onReset={hasFilters ? onReset : null}
        info={`${total}`}
        loading={loading}
      >
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
          <option value="">{t('data1c.anyType')}</option>
          <option value="plan">{t('data1c.imports.typeName.plan')}</option>
          <option value="repair">{t('data1c.imports.typeName.repair')}</option>
          <option value="performed">{t('data1c.imports.typeName.performed')}</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1 rounded-md text-sm"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
          <option value="">{t('data1c.anyStatus')}</option>
          <option value="success">{t('data1c.imports.statusName.success')}</option>
          <option value="partial">{t('data1c.imports.statusName.partial')}</option>
          <option value="pending">{t('data1c.imports.statusName.pending')}</option>
          <option value="error_unknown_format">{t('data1c.imports.statusName.error_unknown_format')}</option>
          <option value="error">{t('data1c.imports.statusName.error')}</option>
        </select>
      </FilterBar>

      <TableShell>
        <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <SortableTh sortKey="receivedAt"     current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colReceived')}</SortableTh>
            <SortableTh sortKey="fromAddress"    current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colFrom')}</SortableTh>
            <SortableTh sortKey="subject"        current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colSubject')}</SortableTh>
            <SortableTh sortKey="attachmentName" current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colFile')}</SortableTh>
            <SortableTh sortKey="detectedType"   current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colType')}</SortableTh>
            <SortableTh sortKey="rowsInserted"   current={sortKey} dir={sortDir} onToggle={toggle} align="right">{t('data1c.imports.colRows')}</SortableTh>
            <SortableTh sortKey="status"         current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.imports.colStatus')}</SortableTh>
            <SortableTh                          current={sortKey} dir={sortDir} align="right">{t('data1c.imports.colAck')}</SortableTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.imports.noImports')}</td></tr>
          ) : sorted.map((r, idx) => {
            const partial = r.rowsInserted != null && r.rowsTotal != null && r.rowsInserted < r.rowsTotal;
            const rowsColor = partial ? '#f59e0b' : '#10b981';
            const isError = (r.status || '').startsWith('error');
            const isAcked = !!r.acknowledgedAt;
            return (
              <tr key={r.id} className={TR_CLASS} style={{ ...tdStyle(idx), borderTop: '1px solid var(--border-glass)' }}>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{fmtDt(r.receivedAt)}</td>
                <td className="px-3 py-2 truncate max-w-[200px]" title={r.fromAddress}>{r.fromAddress}</td>
                <td className="px-3 py-2 truncate max-w-[260px]" title={r.subject} style={{ color: 'var(--text-secondary)' }}>{r.subject || <Dash />}</td>
                <td className="px-3 py-2 truncate max-w-[280px] font-mono text-xs" title={r.attachmentName} style={{ color: 'var(--text-secondary)' }}>{r.attachmentName || <Dash />}</td>
                <td className="px-3 py-2"><ImportTypeBadge type={r.detectedType} /></td>
                <td className="px-3 py-2 text-right font-mono">
                  <span style={{ color: rowsColor, fontWeight: 600 }}>{r.rowsInserted ?? '—'}</span>
                  <span style={{ color: 'var(--text-muted)' }}> / {r.rowsTotal ?? '—'}</span>
                </td>
                <td className="px-3 py-2"><ImportStatusBadge status={r.status} error={r.errorMessage} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {!isError ? (
                    <Dash />
                  ) : isAcked ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#10b981' }} title={`${r.acknowledgedBy || ''} · ${fmtDt(r.acknowledgedAt) || ''}`}>
                      <CheckCircle2 size={12} /> {t('data1c.imports.ackedShort')}
                      {canImport && (
                        <button onClick={() => onAcknowledge(r.id, true)}
                          className="ml-1 px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
                          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
                          title={t('data1c.imports.unacknowledge')}>
                          <Bell size={10} />
                        </button>
                      )}
                    </span>
                  ) : canImport ? (
                    <button onClick={() => onAcknowledge(r.id, false)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
                      style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      title={t('data1c.imports.acknowledgeHint')}>
                      <BellOff size={12} /> {t('data1c.imports.acknowledge')}
                    </button>
                  ) : (
                    <Dash />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pagination
        page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} totalItems={total}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Raw ----------
const RAW_COLUMNS = {
  plan: [
    { key: 'receivedAt',     i18n: 'received', fmt: 'dt',   sortable: true },
    { key: 'number',         i18n: 'number',   fmt: 'mono', sortable: true },
    { key: 'plateNumber',    i18n: 'plate',    sortable: true },
    { key: 'vin',            i18n: 'vin',      fmt: 'mono', sortable: true },
    { key: 'scheduledStart', i18n: 'scheduledStart', fmt: 'dt', sortable: true },
    { key: 'scheduledEnd',   i18n: 'scheduledEnd',   fmt: 'dt', sortable: true },
    { key: 'postRawName',    i18n: 'post',     sortable: true },
    { key: 'durationSec',    i18n: 'duration', fmt: 'num',  sortable: true, align: 'right' },
    { key: 'isOutdated',     i18n: 'outdated', fmt: 'bool', sortable: true },
  ],
  repair: [
    { key: 'receivedAt',     i18n: 'received',   fmt: 'dt',   sortable: true },
    { key: 'orderNumber',    i18n: 'number',     fmt: 'mono', sortable: true },
    { key: 'plateNumber1',   i18n: 'plate',      sortable: true },
    { key: 'vin',            i18n: 'vin',        fmt: 'mono', sortable: true },
    { key: 'state',          i18n: 'state',      fmt: 'state', sortable: true },
    { key: 'repairKind',     i18n: 'repairKind', sortable: true },
    { key: 'workStartedAt',  i18n: 'workStart',  fmt: 'dt',   sortable: true },
    { key: 'workFinishedAt', i18n: 'workEnd',    fmt: 'dt',   sortable: true },
    { key: 'closedAt',       i18n: 'closed',     fmt: 'dt',   sortable: true },
    { key: 'master',         i18n: 'master',     sortable: true },
  ],
  performed: [
    { key: 'receivedAt',    i18n: 'received',   fmt: 'dt',   sortable: true },
    { key: 'orderNumber',   i18n: 'number',     fmt: 'mono', sortable: true },
    { key: 'plateNumber',   i18n: 'plate',      sortable: true },
    { key: 'vin',           i18n: 'vin',        fmt: 'mono', sortable: true },
    { key: 'executor',      i18n: 'executor',   sortable: true },
    { key: 'repairKind',    i18n: 'repairKind', sortable: true },
    { key: 'workStartedAt', i18n: 'workStart',  fmt: 'dt',   sortable: true },
    { key: 'closedAt',      i18n: 'closed',     fmt: 'dt',   sortable: true },
    { key: 'normHours',     i18n: 'normHours',  fmt: 'num',  sortable: true, align: 'right' },
    { key: 'mileage',       i18n: 'mileage',    fmt: 'num',  sortable: true, align: 'right' },
  ],
};

function TabRaw({ api }) {
  const { t } = useTranslation();
  const [type, setType] = useState('plan');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState({ preset: 'all', from: null, to: null });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * perPage;
      const params = new URLSearchParams({ take: String(perPage), skip: String(skip) });
      if (search) params.set('q', search);
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
      const r = await api.get(`/api/oneC/raw/${type}?${params.toString()}`);
      setItems(r.data?.items || []);
      setTotal(r.data?.total || 0);
    } finally {
      setLoading(false);
    }
  }, [api, type, search, page, perPage, period.from, period.to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, search, period.preset, period.from, period.to]);

  const cols = RAW_COLUMNS[type];
  const { sorted, sortKey, sortDir, toggle } = useTableSort(items, 'receivedAt', 'desc');

  const fmtCell = (val, fmt) => {
    if (val == null || val === '') return <Dash />;
    if (fmt === 'dt') return <span style={{ color: 'var(--text-secondary)' }}>{fmtDt(val)}</span>;
    if (fmt === 'bool') return val ? <span style={{ color: '#f59e0b' }}>✓</span> : <Dash />;
    if (fmt === 'mono') return <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{val}</span>;
    if (fmt === 'num') return <span className="font-mono">{val}</span>;
    if (fmt === 'state') return <StateBadge state={String(val)} size="sm" />;
    return String(val);
  };

  const onReset = () => { setSearch(''); setPeriod({ preset: 'all', from: null, to: null }); };
  const hasFilters = !!search || period.preset !== 'all';

  return (
    <div className="space-y-3">
      {/* Подтабы как сегменты */}
      <div className="flex items-center gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        {['plan', 'repair', 'performed'].map((id) => (
          <button key={id} onClick={() => setType(id)}
            className="px-3 py-1.5 rounded-md text-sm transition-all"
            style={{
              background: type === id ? 'var(--accent)' : 'transparent',
              color: type === id ? 'white' : 'var(--text-secondary)',
              fontWeight: type === id ? 600 : 500,
            }}>
            {t(`data1c.raw.subtab.${id}`)}
          </button>
        ))}
      </div>

      <FilterBar
        period={period} onPeriodChange={setPeriod} periodLabel={t('data1c.filterByReceived')}
        search={search} onSearchChange={setSearch} searchPlaceholder={t('data1c.raw.searchPlaceholder')}
        onRefresh={load} onReset={hasFilters ? onReset : null}
        info={`${total}`}
        loading={loading}
      />

      <TableShell>
        <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            {cols.map((c) => (
              <SortableTh key={c.key} sortKey={c.sortable ? c.key : null} current={sortKey} dir={sortDir} onToggle={toggle} align={c.align || 'left'}>
                {t(`data1c.raw.col.${c.i18n}`)}
              </SortableTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && items.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : sorted.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
          ) : sorted.map((r, idx) => (
            <tr key={r.id} className={TR_CLASS} style={{ ...tdStyle(idx), borderTop: '1px solid var(--border-glass)' }}>
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}>{fmtCell(r[c.key], c.fmt)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pagination
        page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} totalItems={total}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Unmapped ----------
function TabUnmapped({ api, canManage }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [allItems, setAllItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyUnresolved, setOnlyUnresolved] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savedRows, setSavedRows] = useState({});  // rawName -> ts (для индикатора "Сохранено")
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const saveTimers = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        api.get('/api/oneC/unmapped-posts'),
        api.get('/api/posts'),
      ]);
      setAllItems(u.data?.items || []);
      setPosts(p.data || []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, onlyUnresolved]);

  // KPI
  const kpi = useMemo(() => {
    const unresolved = allItems.filter((r) => !r.resolved).length;
    const tracked = allItems.filter((r) => r.resolved && !!r.resolvedPostId).length;
    const skipped = allItems.filter((r) => r.resolved && r.resolvedAsNonTracked).length;
    return { total: allItems.length, unresolved, tracked, skipped };
  }, [allItems]);

  // Фильтрация
  const filtered = useMemo(() => {
    let res = allItems;
    if (onlyUnresolved) res = res.filter((r) => !r.resolved);
    if (search) {
      const q = search.toLowerCase();
      res = res.filter((r) => (r.rawName || '').toLowerCase().includes(q));
    }
    return res;
  }, [allItems, search, onlyUnresolved]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort(filtered, 'occurrences', 'desc');

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const items = sorted.slice((page - 1) * perPage, page * perPage);

  // Auto-save с debounce 600мс. Не дёргаем backend на каждом клике.
  const scheduleSave = (rawName, draft) => {
    setDrafts((p) => ({ ...p, [rawName]: draft }));
    if (saveTimers.current[rawName]) clearTimeout(saveTimers.current[rawName]);
    saveTimers.current[rawName] = setTimeout(async () => {
      try {
        await api.post('/api/oneC/unmapped-posts/resolve', {
          rawName,
          postId: draft.postId || null,
          isTracked: draft.isTracked,
        });
        setSavedRows((p) => ({ ...p, [rawName]: Date.now() }));
        // Тихо обновим данные через секунду
        setTimeout(() => load(), 800);
      } catch (e) {
        toast.error(t('data1c.savingError') + ': ' + e.message);
      }
    }, 600);
  };

  const onReset = () => { setSearch(''); setOnlyUnresolved(false); };
  const hasFilters = !!search || onlyUnresolved;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('data1c.kpi.unmapped.total')}      value={kpi.total}      icon={Layers}        tone="default" />
        <KpiCard label={t('data1c.kpi.unmapped.unresolved')} value={kpi.unresolved} icon={AlertTriangle} tone={kpi.unresolved > 0 ? 'warning' : 'success'} />
        <KpiCard label={t('data1c.kpi.unmapped.tracked')}    value={kpi.tracked}    icon={CheckCircle2}  tone="success" />
        <KpiCard label={t('data1c.kpi.unmapped.skipped')}    value={kpi.skipped}    icon={FilterX}       tone="info" />
      </div>

      <FilterBar
        showPeriod={false}
        search={search} onSearchChange={setSearch} searchPlaceholder={t('data1c.unmapped.searchPlaceholder')}
        onRefresh={load} onReset={hasFilters ? onReset : null}
        info={t('data1c.found', { shown: filtered.length, total: allItems.length })}
        loading={loading}
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded-md"
          style={{ background: onlyUnresolved ? 'var(--accent-light)' : 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <input type="checkbox" checked={onlyUnresolved} onChange={(e) => setOnlyUnresolved(e.target.checked)} />
          {t('data1c.onlyUnresolved')}
        </label>
      </FilterBar>

      <TableShell>
        <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <SortableTh sortKey="rawName"     current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.unmapped.colRawName')}</SortableTh>
            <SortableTh sortKey="occurrences" current={sortKey} dir={sortDir} onToggle={toggle} align="right">{t('data1c.unmapped.colOccurrences')}</SortableTh>
            <SortableTh sortKey="firstSeenAt" current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.unmapped.colFirstSeen')}</SortableTh>
            <SortableTh sortKey="lastSeenAt"  current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.unmapped.colLastSeen')}</SortableTh>
            <SortableTh                       current={sortKey} dir={sortDir}>{t('data1c.unmapped.colResolution')}</SortableTh>
            <SortableTh                       current={sortKey} dir={sortDir}></SortableTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.unmapped.allResolved')}</td></tr>
          ) : items.map((r, idx) => {
            const draft = drafts[r.rawName] || { postId: r.resolvedPostId || '', isTracked: !r.resolvedAsNonTracked };
            const wasSaved = savedRows[r.rawName] && Date.now() - savedRows[r.rawName] < 4000;
            return (
              <tr key={r.rawName} className={TR_CLASS} style={{ ...tdStyle(idx), borderTop: '1px solid var(--border-glass)' }}>
                <td className="px-3 py-2 font-mono text-xs">{r.rawName}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{r.occurrences}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDt(r.firstSeenAt) || <Dash />}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDt(r.lastSeenAt) || <Dash />}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={draft.postId || ''}
                        onChange={(e) => scheduleSave(r.rawName, { ...draft, postId: e.target.value })}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                        <option value="">{t('data1c.unmapped.notOurPost')}</option>
                        {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={!!draft.isTracked}
                          onChange={(e) => scheduleSave(r.rawName, { ...draft, isTracked: e.target.checked })} />
                        {t('data1c.unmapped.track')}
                      </label>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {r.resolved ? (r.resolvedAsNonTracked ? t('data1c.unmapped.resolvedNotOurPost') : t('data1c.unmapped.resolved')) : t('data1c.unmapped.unresolved')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {wasSaved && (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#10b981' }}>
                      <CheckCircle2 size={12} /> {t('data1c.saved')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pagination
        page={page} totalPages={totalPages} totalItems={sorted.length}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Payroll ----------
function TabPayroll({ api }) {
  const { t } = useTranslation();
  const [data, setData] = useState({ items: [], totalNorm: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ preset: 'month', ...(() => {
    const now = new Date();
    const m = new Date(now); m.setDate(m.getDate() - 29); m.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,999);
    return { from: m.toISOString(), to: e.toISOString() };
  })() });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
      const r = await api.get(`/api/oneC/payroll?${params.toString()}`);
      setData(r.data || { items: [], totalNorm: 0 });
    } finally {
      setLoading(false);
    }
  }, [api, period.from, period.to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [period.preset, period.from, period.to]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort(data.items || [], 'normHours', 'desc');

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageItems = sorted.slice((page - 1) * perPage, page * perPage);

  const kpi = useMemo(() => {
    const items = data.items || [];
    const orders = items.reduce((s, r) => s + (r.orders || 0), 0);
    const avg = items.length ? Math.round((data.totalNorm / items.length) * 10) / 10 : 0;
    return { executors: items.length, normHours: data.totalNorm, orders, avg };
  }, [data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('data1c.kpi.payroll.executors')} value={kpi.executors} icon={Users}    tone="default" />
        <KpiCard label={t('data1c.kpi.payroll.normHours')} value={kpi.normHours} icon={Hourglass} tone="accent" hint={t('data1c.payroll.hoursUnit')} />
        <KpiCard label={t('data1c.kpi.payroll.orders')}    value={kpi.orders}    icon={ListChecks} tone="info" />
        <KpiCard label={t('data1c.kpi.payroll.avg')}       value={kpi.avg}       icon={BarChart3} tone="success" hint={t('data1c.payroll.hoursUnit')} />
      </div>

      <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {t('data1c.filterByClosed')}
        </span>
        <PeriodPresets value={period} onChange={setPeriod} allowAll={false} />
        <button onClick={load} disabled={loading}
          className="ml-auto px-2.5 py-1 rounded-md text-xs flex items-center gap-1"
          style={{ background: 'var(--accent)', color: 'white' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {t('data1c.common.refresh')}
        </button>
      </div>

      <TableShell>
        <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <SortableTh sortKey="executor"  current={sortKey} dir={sortDir} onToggle={toggle}>{t('data1c.payroll.colExecutor')}</SortableTh>
            <SortableTh sortKey="normHours" current={sortKey} dir={sortDir} onToggle={toggle} align="right">{t('data1c.payroll.colNormHours')}</SortableTh>
            <SortableTh sortKey="orders"    current={sortKey} dir={sortDir} onToggle={toggle} align="right">{t('data1c.payroll.colOrders')}</SortableTh>
            <SortableTh                     current={sortKey} dir={sortDir}>{t('data1c.payroll.colRepairKinds')}</SortableTh>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : pageItems.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
          ) : pageItems.map((r, idx) => {
            // Глобальный ранг (с учётом всей сортировки): первая страница и сорт по normHours desc → топ-3 цветной маркер.
            const globalRank = (page - 1) * perPage + idx;
            const medal = sortKey === 'normHours' && sortDir === 'desc' ? globalRank : -1;
            const stripe = medal === 0 ? '#fbbf24' : medal === 1 ? '#cbd5e1' : medal === 2 ? '#d97706' : 'transparent';
            return (
              <tr key={r.executor} className={TR_CLASS} style={{ ...tdStyle(idx), borderTop: '1px solid var(--border-glass)', boxShadow: stripe !== 'transparent' ? `inset 4px 0 0 ${stripe}` : undefined }}>
                <td className="px-3 py-2 font-medium">{r.executor}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{r.normHours}</td>
                <td className="px-3 py-2 text-right font-mono">{r.orders}</td>
                <td className="px-3 py-2"><RepairKindChips kinds={r.repairKinds} /></td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pagination
        page={page} totalPages={totalPages} totalItems={sorted.length}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Settings ----------
function SettingsCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} style={{ color: 'var(--accent)' }} />}
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function TabSettings({ api }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [pwd, setPwd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.get('/api/oneC/config');
    setCfg(r.data || null);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading || !cfg) return <div style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</div>;

  const onChange = (field, value) => setCfg((p) => ({ ...p, [field]: value }));

  const onSave = async () => {
    setSaving(true);
    try {
      const body = {
        host: cfg.host, port: Number(cfg.port), useSsl: !!cfg.useSsl, user: cfg.user,
        fromFilter: cfg.fromFilter, subjectMask: cfg.subjectMask || null,
        intervalMinutes: Number(cfg.intervalMinutes), matchWindowHours: Number(cfg.matchWindowHours),
        enabled: !!cfg.enabled, markAsRead: !!cfg.markAsRead,
        deleteAfterDays: cfg.deleteAfterDays === '' || cfg.deleteAfterDays == null ? null : Number(cfg.deleteAfterDays),
      };
      if (pwd && pwd !== '****') body.password = pwd;
      const r = await api.put('/api/oneC/config', body);
      setCfg(r.data);
      setPwd('');
      toast.success(t('data1c.common.saved'));
    } catch (e) {
      toast.error(t('data1c.common.error') + ': ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!pwd && !cfg.passwordSet) { toast.warning(t('data1c.settings.enterPasswordForTest')); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const body = { host: cfg.host, port: Number(cfg.port), useSsl: !!cfg.useSsl, user: cfg.user };
      if (pwd) body.password = pwd;
      const r = await api.post('/api/oneC/config/test', body);
      setTestResult(r.data);
      if (r.data?.ok) toast.success(t('data1c.settings.ok'));
      else toast.error(r.data?.error || t('data1c.settings.testFailed'));
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const fld = (label, key, type = 'text', extra = {}) => (
    <label className="block">
      <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        type={type} value={cfg[key] ?? ''} onChange={(e) => onChange(key, e.target.value)}
        className="w-full px-2 py-1.5 rounded-md text-sm"
        style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        {...extra}
      />
    </label>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-5xl">
      <SettingsCard title={t('data1c.settings.host') + ' / ' + t('data1c.settings.user')} icon={Server}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fld(t('data1c.settings.host'), 'host')}
          {fld(t('data1c.settings.port'), 'port', 'number')}
          {fld(t('data1c.settings.user'), 'user', 'email')}
          <label className="block">
            <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('data1c.settings.password')} <span style={{ color: cfg.passwordSet ? '#10b981' : 'var(--text-muted)' }}>{cfg.passwordSet ? t('data1c.settings.passwordSaved') : t('data1c.settings.passwordNotSet')}</span>
            </span>
            <input
              type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder={cfg.passwordSet ? '****' : t('data1c.settings.passwordPlaceholder')}
              className="w-full px-2 py-1.5 rounded-md text-sm"
              style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={!!cfg.useSsl} onChange={(e) => onChange('useSsl', e.target.checked)} />
            {t('data1c.settings.ssl')}
          </label>
        </div>
      </SettingsCard>

      <SettingsCard title={t('data1c.settings.fromFilter')} icon={Mail}>
        <div className="space-y-3">
          {fld(t('data1c.settings.fromFilter'), 'fromFilter')}
          {fld(t('data1c.settings.subjectMask'), 'subjectMask')}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!cfg.markAsRead} onChange={(e) => onChange('markAsRead', e.target.checked)} />
            {t('data1c.settings.markAsRead')}
          </label>
        </div>
      </SettingsCard>

      <SettingsCard title={t('data1c.settings.intervalMinutes')} icon={Hourglass}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {fld(t('data1c.settings.intervalMinutes'), 'intervalMinutes', 'number', { min: 5, max: 1440 })}
          {fld(t('data1c.settings.matchWindowHours'), 'matchWindowHours', 'number', { min: 1, max: 168 })}
          {fld(t('data1c.settings.deleteAfterDays'), 'deleteAfterDays', 'number', { min: 0 })}
        </div>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => onChange('enabled', e.target.checked)} />
            <span style={{ color: cfg.enabled ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
              {t('data1c.settings.enabled')}
            </span>
          </label>
        </div>
      </SettingsCard>

      <SettingsCard title={t('data1c.settings.testConnection')} icon={CheckCircle2}>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={onSave} disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <Save size={14} /> {t('data1c.common.save')}
          </button>
          <button onClick={onTest} disabled={testing}
            className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} /> {t('data1c.settings.testConnection')}
          </button>
          {testResult && (
            <span className="text-sm flex items-center gap-1" style={{ color: testResult.ok ? '#10b981' : '#ef4444' }}>
              {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {testResult.ok ? t('data1c.settings.ok') : (testResult.error || t('data1c.settings.testFailed'))}
            </span>
          )}
        </div>
        {cfg.lastFetchAt && (
          <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            {t('data1c.settings.lastFetch')}: {fmtDt(cfg.lastFetchAt)} — {cfg.lastFetchStatus}
            {cfg.lastFetchError ? ` (${cfg.lastFetchError})` : ''}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

// ---------- Page ----------
export default function Data1C() {
  const { t } = useTranslation();
  const { api, hasPermission } = useAuth();
  const visibleTabs = TAB_DEFS.filter((tab) => !tab.perm || (hasPermission && hasPermission(tab.perm)));
  const [active, setActive] = useState(visibleTabs[0]?.id || 'current');
  const [tabBadges, setTabBadges] = useState({});

  const canImport = hasPermission && hasPermission('manage_1c_import');

  // Подгружаем счётчики для табов фоном — только то, что важно показать.
  // Несопоставленные: количество нерешённых. Импорты: ошибок за неделю.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      // Несопоставленные
      if (canImport) {
        try {
          const u = await api.get('/api/oneC/unmapped-posts');
          const items = u.data?.items || [];
          const unresolved = items.filter((r) => !r.resolved).length;
          if (unresolved > 0) next.unmapped = { count: unresolved, tone: 'warning' };
        } catch { /* ignore */ }
      }
      // Импорты — некквитированные ошибки за 7 дней
      try {
        const now = new Date();
        const w = new Date(now); w.setDate(w.getDate() - 7);
        const params = new URLSearchParams({ take: '500', from: w.toISOString(), acknowledged: 'false' });
        const r = await api.get(`/api/oneC/imports?${params.toString()}`);
        const items = r.data?.items || [];
        const errors = items.filter((it) => (it.status || '').startsWith('error')).length;
        if (errors > 0) next.imports = { count: errors, tone: 'danger' };
      } catch { /* ignore */ }

      if (!cancelled) setTabBadges(next);
    })();
    return () => { cancelled = true; };
  }, [api, canImport, active]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Database size={20} /> {t('data1c.title')}
        </h1>
        <HelpButton pageKey="data1c" />
      </div>

      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border-glass)' }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const badge = tabBadges[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="px-3 py-2 text-sm flex items-center gap-1.5 transition-all whitespace-nowrap relative"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <Icon size={14} /> {t(`data1c.tabs.${tab.id}`)}
              {badge && (
                <span
                  className="inline-flex items-center justify-center rounded-full font-bold"
                  style={{
                    background: badge.tone === 'danger' ? '#ef4444' : '#f59e0b',
                    color: 'white',
                    fontSize: 10,
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                  }}
                >
                  {badge.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {active === 'current'  && <TabCurrent  api={api} />}
        {active === 'imports'  && <TabImports  api={api} canImport={canImport} />}
        {active === 'raw'      && <TabRaw      api={api} />}
        {active === 'unmapped' && <TabUnmapped api={api} canManage={canImport} />}
        {active === 'payroll'  && <TabPayroll  api={api} />}
        {active === 'settings' && <TabSettings api={api} />}
      </div>
    </div>
  );
}
