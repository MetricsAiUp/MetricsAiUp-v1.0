// Данные 1С — новый экран на 5 вкладок:
//   Сейчас, Импорты, Несопоставленные, Выработка, Настройки.
// Под капотом — REST /api/oneC/*.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Database, Inbox, AlertTriangle, BarChart3, Settings, Upload, RefreshCw, Save, CheckCircle2, XCircle, Layers } from 'lucide-react';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';

const TAB_DEFS = [
  { id: 'current', icon: Database, perm: 'view_1c' },
  { id: 'imports', icon: Inbox, perm: 'view_1c' },
  { id: 'raw', icon: Layers, perm: 'view_1c' },
  { id: 'unmapped', icon: AlertTriangle, perm: 'manage_1c_import' },
  { id: 'payroll', icon: BarChart3, perm: 'view_1c' },
  { id: 'settings', icon: Settings, perm: 'manage_1c_config' },
];

function fmtDt(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(s); }
}

// ---------- Tab: Current ----------
function TabCurrent({ api }) {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.get('/api/oneC/current?take=50000');
    setAllItems(r.data?.items || []);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, state]);

  const filtered = (() => {
    let res = allItems;
    if (state) {
      const st = state.toLowerCase();
      res = res.filter((r) => (r.state || '').toLowerCase().includes(st));
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
  })();
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const items = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          placeholder={t('data1c.current.searchPlaceholder')}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1 rounded text-sm flex-1 min-w-[200px]"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        />
        <input
          placeholder={t('data1c.current.statePlaceholder')} value={state} onChange={(e) => setState(e.target.value)}
          className="px-2 py-1 rounded text-sm w-[140px]"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        />
        <button onClick={load} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ background: 'var(--accent)', color: 'white' }}>
          <RefreshCw size={14} /> {t('data1c.common.refresh')}
        </button>
      </div>
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colNumber')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colPlate')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colVin')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colState')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colPlan')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colClosed')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colNorm')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.current.colExecutor')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                <td className="px-2 py-1 font-mono">{r.order_number}</td>
                <td className="px-2 py-1">{r.plate_number || '—'}</td>
                <td className="px-2 py-1 font-mono">{r.vin || '—'}</td>
                <td className="px-2 py-1">{r.state || '—'}</td>
                <td className="px-2 py-1">{fmtDt(r.scheduled_start)}</td>
                <td className="px-2 py-1">{fmtDt(r.closed_at)}</td>
                <td className="px-2 py-1">{r.norm_hours ?? '—'}</td>
                <td className="px-2 py-1">{r.executor || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page} totalPages={totalPages} totalItems={filtered.length}
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
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const skip = (page - 1) * perPage;
    const r = await api.get(`/api/oneC/imports?take=${perPage}&skip=${skip}`);
    setItems(r.data?.items || []);
    setTotal(r.data?.total || 0);
    setLoading(false);
  }, [api, page, perPage]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-3">
      {canImport && (
        <div className="glass-static p-3 rounded-lg flex items-center gap-3 flex-wrap">
          <select value={forceType} onChange={(e) => setForceType(e.target.value)}
            className="px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <option value="">{t('data1c.imports.autoDetectType')}</option>
            <option value="plan">plan</option>
            <option value="repair">repair</option>
            <option value="performed">performed</option>
          </select>
          <label className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <Upload size={14} /> {t('data1c.imports.uploadXlsx')}
            <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" />
          </label>
          <button onClick={onRun} disabled={running} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {t('data1c.imports.imapCycle')}
          </button>
        </div>
      )}
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colReceived')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colFrom')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colSubject')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colFile')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colType')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colRows')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.imports.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.imports.noImports')}</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                <td className="px-2 py-1">{fmtDt(r.receivedAt)}</td>
                <td className="px-2 py-1 truncate max-w-[200px]" title={r.fromAddress}>{r.fromAddress}</td>
                <td className="px-2 py-1 truncate max-w-[200px]" title={r.subject}>{r.subject || '—'}</td>
                <td className="px-2 py-1 truncate max-w-[250px]" title={r.attachmentName}>{r.attachmentName || '—'}</td>
                <td className="px-2 py-1">{r.detectedType || '—'}</td>
                <td className="px-2 py-1">{r.rowsInserted ?? '—'} / {r.rowsTotal ?? '—'}</td>
                <td className="px-2 py-1" style={{ color: r.status === 'success' ? '#10b981' : (r.status || '').startsWith('error') ? '#ef4444' : 'var(--text-muted)' }}>
                  {r.status}{r.errorMessage ? `: ${r.errorMessage}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [drafts, setDrafts] = useState({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, p] = await Promise.all([
      api.get('/api/oneC/unmapped-posts'),
      api.get('/api/posts'),
    ]);
    setAllItems(u.data?.items || []);
    setPosts(p.data || []);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(allItems.length / perPage));
  const items = allItems.slice((page - 1) * perPage, page * perPage);

  const onSave = async (rawName) => {
    const draft = drafts[rawName] || {};
    try {
      await api.post('/api/oneC/unmapped-posts/resolve', {
        rawName,
        postId: draft.postId || null,
        isTracked: draft.isTracked,
      });
      await load();
    } catch (e) {
      toast.error(t('data1c.common.error') + ': ' + e.message);
    }
  };

  return (
    <div className="space-y-3">
    <div className="glass-static rounded-lg overflow-auto">
      <table className="w-full text-xs">
        <thead style={{ background: 'var(--bg-glass)' }}>
          <tr>
            <th className="text-left px-2 py-1.5">{t('data1c.unmapped.colRawName')}</th>
            <th className="text-left px-2 py-1.5">{t('data1c.unmapped.colOccurrences')}</th>
            <th className="text-left px-2 py-1.5">{t('data1c.unmapped.colFirstSeen')}</th>
            <th className="text-left px-2 py-1.5">{t('data1c.unmapped.colLastSeen')}</th>
            <th className="text-left px-2 py-1.5">{t('data1c.unmapped.colResolution')}</th>
            <th className="text-left px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.unmapped.allResolved')}</td></tr>
          ) : items.map((r) => {
            const draft = drafts[r.rawName] || { postId: r.resolvedPostId || '', isTracked: !r.resolvedAsNonTracked };
            return (
              <tr key={r.rawName} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                <td className="px-2 py-1 font-mono">{r.rawName}</td>
                <td className="px-2 py-1">{r.occurrences}</td>
                <td className="px-2 py-1">{fmtDt(r.firstSeenAt)}</td>
                <td className="px-2 py-1">{fmtDt(r.lastSeenAt)}</td>
                <td className="px-2 py-1">
                  {canManage ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={draft.postId || ''}
                        onChange={(e) => setDrafts((p) => ({ ...p, [r.rawName]: { ...draft, postId: e.target.value } }))}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
                        <option value="">{t('data1c.unmapped.notOurPost')}</option>
                        {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={!!draft.isTracked}
                          onChange={(e) => setDrafts((p) => ({ ...p, [r.rawName]: { ...draft, isTracked: e.target.checked } }))} />
                        {t('data1c.unmapped.track')}
                      </label>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{r.resolved ? (r.resolvedAsNonTracked ? t('data1c.unmapped.resolvedNotOurPost') : t('data1c.unmapped.resolved')) : t('data1c.unmapped.unresolved')}</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {canManage && (
                    <button onClick={() => onSave(r.rawName)} className="p-1 rounded hover:opacity-70" title={t('data1c.unmapped.saveTitle')}>
                      <Save size={14} style={{ color: '#10b981' }} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      <Pagination
        page={page} totalPages={totalPages} totalItems={allItems.length}
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const r = await api.get(`/api/oneC/payroll?${params.toString()}`);
    setData(r.data || { items: [], totalNorm: 0 });
    setLoading(false);
  }, [api, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [from, to]);

  const totalPages = Math.max(1, Math.ceil((data.items?.length || 0) / perPage));
  const pageItems = (data.items || []).slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('data1c.payroll.from')}</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="px-2 py-1 rounded text-sm" style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
        <label className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('data1c.payroll.to')}</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="px-2 py-1 rounded text-sm" style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
        <span className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>{t('data1c.payroll.totalHours')}: <b>{data.totalNorm}</b> {t('data1c.payroll.hoursUnit')}</span>
      </div>
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">{t('data1c.payroll.colExecutor')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.payroll.colNormHours')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.payroll.colOrders')}</th>
              <th className="text-left px-2 py-1.5">{t('data1c.payroll.colRepairKinds')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
            ) : pageItems.map((r) => (
              <tr key={r.executor} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                <td className="px-2 py-1">{r.executor}</td>
                <td className="px-2 py-1 font-semibold">{r.normHours}</td>
                <td className="px-2 py-1">{r.orders}</td>
                <td className="px-2 py-1">
                  {(r.repairKinds || []).map((rk) => `${rk.kind} (${rk.count})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page} totalPages={totalPages} totalItems={data.items?.length || 0}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Raw (план / ремонты / выработка) ----------
const RAW_COLUMNS = {
  plan: [
    { key: 'receivedAt', i18n: 'received', fmt: 'dt' },
    { key: 'number', i18n: 'number' },
    { key: 'plateNumber', i18n: 'plate' },
    { key: 'vin', i18n: 'vin' },
    { key: 'scheduledStart', i18n: 'scheduledStart', fmt: 'dt' },
    { key: 'scheduledEnd', i18n: 'scheduledEnd', fmt: 'dt' },
    { key: 'postRawName', i18n: 'post' },
    { key: 'durationSec', i18n: 'duration' },
    { key: 'isOutdated', i18n: 'outdated', fmt: 'bool' },
  ],
  repair: [
    { key: 'receivedAt', i18n: 'received', fmt: 'dt' },
    { key: 'orderNumber', i18n: 'number' },
    { key: 'plateNumber1', i18n: 'plate' },
    { key: 'vin', i18n: 'vin' },
    { key: 'state', i18n: 'state' },
    { key: 'repairKind', i18n: 'repairKind' },
    { key: 'workStartedAt', i18n: 'workStart', fmt: 'dt' },
    { key: 'workFinishedAt', i18n: 'workEnd', fmt: 'dt' },
    { key: 'closedAt', i18n: 'closed', fmt: 'dt' },
    { key: 'master', i18n: 'master' },
  ],
  performed: [
    { key: 'receivedAt', i18n: 'received', fmt: 'dt' },
    { key: 'orderNumber', i18n: 'number' },
    { key: 'plateNumber', i18n: 'plate' },
    { key: 'vin', i18n: 'vin' },
    { key: 'executor', i18n: 'executor' },
    { key: 'repairKind', i18n: 'repairKind' },
    { key: 'workStartedAt', i18n: 'workStart', fmt: 'dt' },
    { key: 'closedAt', i18n: 'closed', fmt: 'dt' },
    { key: 'normHours', i18n: 'normHours' },
    { key: 'mileage', i18n: 'mileage' },
  ],
};

function TabRaw({ api }) {
  const { t } = useTranslation();
  const [type, setType] = useState('plan');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const skip = (page - 1) * perPage;
    const params = new URLSearchParams({ take: String(perPage), skip: String(skip) });
    if (search) params.set('orderNumber', search);
    const r = await api.get(`/api/oneC/raw/${type}?${params.toString()}`);
    setItems(r.data?.items || []);
    setTotal(r.data?.total || 0);
    setLoading(false);
  }, [api, type, search, page, perPage]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [type, search]);

  const onSearch = (e) => { e.preventDefault(); setPage(1); load(); };

  const cols = RAW_COLUMNS[type];

  const fmtCell = (val, fmt) => {
    if (val == null || val === '') return '—';
    if (fmt === 'dt') return fmtDt(val);
    if (fmt === 'bool') return val ? '✓' : '';
    return String(val);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {['plan', 'repair', 'performed'].map((id) => (
          <button key={id} onClick={() => setType(id)}
            className="px-3 py-1.5 rounded text-sm transition-all"
            style={{
              background: type === id ? 'var(--accent)' : 'var(--bg-glass)',
              color: type === id ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border-glass)',
              fontWeight: type === id ? 600 : 400,
            }}>
            {t(`data1c.raw.subtab.${id}`)}
          </button>
        ))}
        <form onSubmit={onSearch} className="flex gap-1 ml-auto items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('data1c.raw.searchPlaceholder')}
            className="px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
          <button type="submit" className="px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} />
          </button>
        </form>
      </div>
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)', position: 'sticky', top: 0 }}>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="text-left px-2 py-1.5">{t(`data1c.raw.col.${c.i18n}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('data1c.common.noData')}</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-1">{fmtCell(r[c.key], c.fmt)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} totalItems={total}
        perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
      />
    </div>
  );
}

// ---------- Tab: Settings ----------
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
    // Если в форме поле пустое — сервер возьмёт сохранённый пароль из БД (passwordSet=true).
    if (!pwd && !cfg.passwordSet) { toast.warning(t('data1c.settings.enterPasswordForTest')); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const body = {
        host: cfg.host, port: Number(cfg.port), useSsl: !!cfg.useSsl, user: cfg.user,
      };
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
        className="w-full px-2 py-1 rounded text-sm"
        style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        {...extra}
      />
    </label>
  );

  return (
    <div className="glass-static p-4 rounded-lg max-w-3xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fld(t('data1c.settings.host'), 'host')}
        {fld(t('data1c.settings.port'), 'port', 'number')}
        {fld(t('data1c.settings.user'), 'user', 'email')}
        <label className="block">
          <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('data1c.settings.password')} {cfg.passwordSet ? t('data1c.settings.passwordSaved') : t('data1c.settings.passwordNotSet')}
          </span>
          <input
            type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
            placeholder={cfg.passwordSet ? '****' : t('data1c.settings.passwordPlaceholder')}
            className="w-full px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
        </label>
        {fld(t('data1c.settings.fromFilter'), 'fromFilter')}
        {fld(t('data1c.settings.subjectMask'), 'subjectMask')}
        {fld(t('data1c.settings.intervalMinutes'), 'intervalMinutes', 'number', { min: 5, max: 1440 })}
        {fld(t('data1c.settings.matchWindowHours'), 'matchWindowHours', 'number', { min: 1, max: 168 })}
        {fld(t('data1c.settings.deleteAfterDays'), 'deleteAfterDays', 'number', { min: 0 })}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.useSsl} onChange={(e) => onChange('useSsl', e.target.checked)} /> {t('data1c.settings.ssl')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => onChange('enabled', e.target.checked)} /> {t('data1c.settings.enabled')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.markAsRead} onChange={(e) => onChange('markAsRead', e.target.checked)} /> {t('data1c.settings.markAsRead')}
        </label>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={onSave} disabled={saving} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          style={{ background: 'var(--accent)', color: 'white' }}>
          <Save size={14} /> {t('data1c.common.save')}
        </button>
        <button onClick={onTest} disabled={testing} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
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
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('data1c.settings.lastFetch')}: {fmtDt(cfg.lastFetchAt)} — {cfg.lastFetchStatus}
          {cfg.lastFetchError ? ` (${cfg.lastFetchError})` : ''}
        </div>
      )}
    </div>
  );
}

// ---------- Page ----------
export default function Data1C() {
  const { t } = useTranslation();
  const { api, hasPermission } = useAuth();
  const visibleTabs = TAB_DEFS.filter((tab) => !tab.perm || (hasPermission && hasPermission(tab.perm)));
  const [active, setActive] = useState(visibleTabs[0]?.id || 'current');

  const canImport = hasPermission && hasPermission('manage_1c_import');

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
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="px-3 py-2 text-sm flex items-center gap-1.5 transition-all whitespace-nowrap"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={14} /> {t(`data1c.tabs.${tab.id}`)}
            </button>
          );
        })}
      </div>

      <div>
        {active === 'current' && <TabCurrent api={api} />}
        {active === 'imports' && <TabImports api={api} canImport={canImport} />}
        {active === 'raw' && <TabRaw api={api} />}
        {active === 'unmapped' && <TabUnmapped api={api} canManage={canImport} />}
        {active === 'payroll' && <TabPayroll api={api} />}
        {active === 'settings' && <TabSettings api={api} />}
      </div>
    </div>
  );
}
