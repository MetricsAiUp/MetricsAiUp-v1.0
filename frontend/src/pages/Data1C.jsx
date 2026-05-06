// Данные 1С — новый экран на 5 вкладок:
//   Сейчас, Импорты, Несопоставленные, Выработка, Настройки.
// Под капотом — REST /api/oneC/*.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, Inbox, AlertTriangle, BarChart3, Settings, Upload, RefreshCw, Save, CheckCircle2, XCircle } from 'lucide-react';

const TABS = [
  { id: 'current', label: 'Сейчас', icon: Database, perm: 'view_1c' },
  { id: 'imports', label: 'Импорты', icon: Inbox, perm: 'view_1c' },
  { id: 'unmapped', label: 'Несопоставленные', icon: AlertTriangle, perm: 'manage_1c_import' },
  { id: 'payroll', label: 'Выработка', icon: BarChart3, perm: 'view_1c' },
  { id: 'settings', label: 'Настройки', icon: Settings, perm: 'manage_1c_config' },
];

function fmtDt(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(s); }
}

// ---------- Tab: Current ----------
function TabCurrent({ api }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ take: '200' });
    if (search) params.set('search', search);
    if (state) params.set('state', state);
    const r = await api.get(`/api/oneC/current?${params.toString()}`);
    setItems(r.data?.items || []);
    setLoading(false);
  }, [api, search, state]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          placeholder="Поиск (номер/VIN/госномер)"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1 rounded text-sm flex-1 min-w-[200px]"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        />
        <input
          placeholder="Состояние" value={state} onChange={(e) => setState(e.target.value)}
          className="px-2 py-1 rounded text-sm w-[140px]"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
        />
        <button onClick={load} className="px-3 py-1.5 rounded text-sm flex items-center gap-1" style={{ background: 'var(--accent)', color: 'white' }}>
          <RefreshCw size={14} /> Обновить
        </button>
      </div>
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">№</th>
              <th className="text-left px-2 py-1.5">Госномер</th>
              <th className="text-left px-2 py-1.5">VIN</th>
              <th className="text-left px-2 py-1.5">Состояние</th>
              <th className="text-left px-2 py-1.5">План</th>
              <th className="text-left px-2 py-1.5">Закрыт</th>
              <th className="text-left px-2 py-1.5">Норма</th>
              <th className="text-left px-2 py-1.5">Исполнитель</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Загрузка…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Нет данных</td></tr>
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
    </div>
  );
}

// ---------- Tab: Imports ----------
function TabImports({ api, canImport }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [forceType, setForceType] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api.get('/api/oneC/imports?take=50');
    setItems(r.data?.items || []);
    setLoading(false);
  }, [api]);

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
      alert(`Загружено: ${file.name}\nТип: ${r.data?.detected || forceType || '—'}\nСтрок: ${r.data?.inserted ?? '—'}`);
      e.target.value = '';
      await load();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };

  const onRun = async () => {
    setRunning(true);
    try {
      const r = await api.post('/api/oneC/imports/run', {});
      alert(`Цикл IMAP: ${r.data?.fetched ?? 0} писем обработано`);
      await load();
    } catch (err) {
      alert('Ошибка: ' + err.message);
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
            <option value="">Авто-детект типа</option>
            <option value="plan">plan</option>
            <option value="repair">repair</option>
            <option value="performed">performed</option>
          </select>
          <label className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <Upload size={14} /> Загрузить xlsx
            <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" />
          </label>
          <button onClick={onRun} disabled={running} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> Цикл IMAP
          </button>
        </div>
      )}
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">Получено</th>
              <th className="text-left px-2 py-1.5">От</th>
              <th className="text-left px-2 py-1.5">Тема</th>
              <th className="text-left px-2 py-1.5">Файл</th>
              <th className="text-left px-2 py-1.5">Тип</th>
              <th className="text-left px-2 py-1.5">Строк</th>
              <th className="text-left px-2 py-1.5">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Загрузка…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Импортов нет</td></tr>
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
    </div>
  );
}

// ---------- Tab: Unmapped ----------
function TabUnmapped({ api, canManage }) {
  const [items, setItems] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const [u, p] = await Promise.all([
      api.get('/api/oneC/unmapped-posts'),
      api.get('/api/posts'),
    ]);
    setItems(u.data?.items || []);
    setPosts(p.data || []);
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

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
      alert('Ошибка: ' + e.message);
    }
  };

  return (
    <div className="glass-static rounded-lg overflow-auto">
      <table className="w-full text-xs">
        <thead style={{ background: 'var(--bg-glass)' }}>
          <tr>
            <th className="text-left px-2 py-1.5">Сырое имя</th>
            <th className="text-left px-2 py-1.5">Встречалось</th>
            <th className="text-left px-2 py-1.5">Первое</th>
            <th className="text-left px-2 py-1.5">Последнее</th>
            <th className="text-left px-2 py-1.5">Резолюция</th>
            <th className="text-left px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Загрузка…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Все имена сопоставлены</td></tr>
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
                        <option value="">— не наш пост —</option>
                        {posts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={!!draft.isTracked}
                          onChange={(e) => setDrafts((p) => ({ ...p, [r.rawName]: { ...draft, isTracked: e.target.checked } }))} />
                        отслеживать
                      </label>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{r.resolved ? (r.resolvedAsNonTracked ? 'не наш пост' : 'сопоставлено') : 'не сопоставлено'}</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {canManage && (
                    <button onClick={() => onSave(r.rawName)} className="p-1 rounded hover:opacity-70" title="Сохранить">
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
  );
}

// ---------- Tab: Payroll ----------
function TabPayroll({ api }) {
  const [data, setData] = useState({ items: [], totalNorm: 0 });
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <label className="text-sm" style={{ color: 'var(--text-muted)' }}>С:</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="px-2 py-1 rounded text-sm" style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
        <label className="text-sm" style={{ color: 'var(--text-muted)' }}>По:</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="px-2 py-1 rounded text-sm" style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
        <span className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>Итого: <b>{data.totalNorm}</b> ч</span>
      </div>
      <div className="glass-static rounded-lg overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ background: 'var(--bg-glass)' }}>
            <tr>
              <th className="text-left px-2 py-1.5">Исполнитель</th>
              <th className="text-left px-2 py-1.5">Нормочасы</th>
              <th className="text-left px-2 py-1.5">Заказов</th>
              <th className="text-left px-2 py-1.5">Виды работ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Загрузка…</td></tr>
            ) : data.items.length === 0 ? (
              <tr><td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>Нет данных</td></tr>
            ) : data.items.map((r) => (
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
    </div>
  );
}

// ---------- Tab: Settings ----------
function TabSettings({ api }) {
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

  if (loading || !cfg) return <div style={{ color: 'var(--text-muted)' }}>Загрузка…</div>;

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
      alert('Сохранено');
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!pwd) { alert('Введите пароль для теста'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/api/oneC/config/test', {
        host: cfg.host, port: Number(cfg.port), useSsl: !!cfg.useSsl, user: cfg.user, password: pwd,
      });
      setTestResult(r.data);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
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
        {fld('IMAP host', 'host')}
        {fld('Порт', 'port', 'number')}
        {fld('Логин (email)', 'user', 'email')}
        <label className="block">
          <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            Пароль {cfg.passwordSet ? '(сохранён, оставьте пустым чтобы не менять)' : '(не задан)'}
          </span>
          <input
            type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
            placeholder={cfg.passwordSet ? '****' : 'введите пароль'}
            className="w-full px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
        </label>
        {fld('Фильтр From', 'fromFilter')}
        {fld('Маска темы (опционально)', 'subjectMask')}
        {fld('Интервал, мин', 'intervalMinutes', 'number', { min: 5, max: 1440 })}
        {fld('Окно матчинга, ч', 'matchWindowHours', 'number', { min: 1, max: 168 })}
        {fld('Удалять после, дней (0/пусто = не удалять)', 'deleteAfterDays', 'number', { min: 0 })}
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.useSsl} onChange={(e) => onChange('useSsl', e.target.checked)} /> SSL
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => onChange('enabled', e.target.checked)} /> Включён
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!cfg.markAsRead} onChange={(e) => onChange('markAsRead', e.target.checked)} /> Помечать как прочитанные
        </label>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={onSave} disabled={saving} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          style={{ background: 'var(--accent)', color: 'white' }}>
          <Save size={14} /> Сохранить
        </button>
        <button onClick={onTest} disabled={testing} className="px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}>
          <RefreshCw size={14} className={testing ? 'animate-spin' : ''} /> Проверить соединение
        </button>
        {testResult && (
          <span className="text-sm flex items-center gap-1" style={{ color: testResult.ok ? '#10b981' : '#ef4444' }}>
            {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {testResult.ok ? 'OK' : (testResult.error || 'ошибка')}
          </span>
        )}
      </div>
      {cfg.lastFetchAt && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Последний цикл: {fmtDt(cfg.lastFetchAt)} — {cfg.lastFetchStatus}
          {cfg.lastFetchError ? ` (${cfg.lastFetchError})` : ''}
        </div>
      )}
    </div>
  );
}

// ---------- Page ----------
export default function Data1C() {
  const { api, hasPermission } = useAuth();
  const visibleTabs = TABS.filter((t) => !t.perm || (hasPermission && hasPermission(t.perm)));
  const [active, setActive] = useState(visibleTabs[0]?.id || 'current');

  const canImport = hasPermission && hasPermission('manage_1c_import');

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Database size={20} /> Данные 1С
      </h1>

      <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border-glass)' }}>
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className="px-3 py-2 text-sm flex items-center gap-1.5 transition-all whitespace-nowrap"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {active === 'current' && <TabCurrent api={api} />}
        {active === 'imports' && <TabImports api={api} canImport={canImport} />}
        {active === 'unmapped' && <TabUnmapped api={api} canManage={canImport} />}
        {active === 'payroll' && <TabPayroll api={api} />}
        {active === 'settings' && <TabSettings api={api} />}
      </div>
    </div>
  );
}
