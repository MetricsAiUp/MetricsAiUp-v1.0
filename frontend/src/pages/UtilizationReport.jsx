import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  BarChart3, Calendar, Settings as SettingsIcon, RefreshCw, Save, X,
  TrendingUp, TrendingDown, AlertTriangle, Download, FileText, Image as ImageIcon,
  Coins, Percent, Clock, Wallet, ArrowUp, ArrowDown, Layers, Building2,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend as RLegend, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import UtilizationHeatmap from '../components/UtilizationHeatmap';
import HelpButton from '../components/HelpButton';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { exportUtilizationPdf } from '../utils/utilizationPdf';

// ─── helpers ──────────────────────────────────────────────────────────────

function isoDate(d) { return d.toISOString().slice(0, 10); }

function periodFromKey(key) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  switch (key) {
    case 'today':     start.setHours(0,0,0,0); break;
    case 'yesterday': start.setDate(start.getDate() - 1); start.setHours(0,0,0,0); end.setDate(end.getDate()-1); end.setHours(23,59,59,999); break;
    case '7d':        start.setDate(start.getDate() - 6); start.setHours(0,0,0,0); break;
    case '30d':       start.setDate(start.getDate() - 29); start.setHours(0,0,0,0); break;
    default:          start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
  }
  return { from: start, to: end };
}

function fmtNumber(n, digits = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function fmtMoney(n, currency = '₽') {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ' + currency;
}

function pctRange(value, marginPct) {
  if (value == null || marginPct == null) return null;
  const delta = value * (marginPct / 100);
  return { low: Math.round(value - delta), high: Math.round(value + delta) };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, unit, sub, color = 'var(--accent)', deltaPct }) {
  const deltaColor = deltaPct == null ? null
    : deltaPct > 0 ? 'var(--success)' : deltaPct < 0 ? 'var(--danger)' : 'var(--text-muted)';
  return (
    <div className="glass-static rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        {Icon && <Icon size={12} />}{label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sub && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      {deltaPct != null && (
        <div className="text-[10px] flex items-center gap-0.5" style={{ color: deltaColor }}>
          {deltaPct > 0 ? <ArrowUp size={10} /> : deltaPct < 0 ? <ArrowDown size={10} /> : null}
          {Math.abs(deltaPct).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ─── Settings modal ───────────────────────────────────────────────────────

function SettingsModal({ open, settings, onClose, onSave, canEdit }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [form, setForm] = useState(() => ({ ...settings }));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        workStart: form.workStart,
        workEnd: form.workEnd,
        workDays: form.workDays,
        hourlyRate: form.hourlyRate === '' || form.hourlyRate == null ? null : Number(form.hourlyRate),
        errorMarginPct: form.errorMarginPct === '' || form.errorMarginPct == null ? null : Number(form.errorMarginPct),
        errorMarginNote: form.errorMarginNote || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const DOW = isRu ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const selectedDays = new Set(String(form.workDays || '').split(',').map(s => Number(s.trim())).filter(Boolean));
  const toggleDay = (i) => {
    const next = new Set(selectedDays);
    if (next.has(i)) next.delete(i); else next.add(i);
    setForm({ ...form, workDays: [...next].sort().join(',') });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="glass rounded-2xl p-5 w-full max-w-md"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('utilization.settings.title')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        <div className="space-y-3">
          {/* Hourly rate */}
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('utilization.settings.rate')} ({t('utilization.settings.rateUnit')})
            </label>
            <input type="number" min="0" step="50"
              value={form.hourlyRate ?? ''}
              disabled={!canEdit}
              onChange={e => setForm({ ...form, hourlyRate: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
          </div>

          {/* Work window */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('utilization.settings.workStart')}
              </label>
              <input type="time"
                value={form.workStart || '08:00'}
                disabled={!canEdit}
                onChange={e => setForm({ ...form, workStart: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('utilization.settings.workEnd')}
              </label>
              <input type="time"
                value={form.workEnd || '20:00'}
                disabled={!canEdit}
                onChange={e => setForm({ ...form, workEnd: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
            </div>
          </div>

          {/* Work days */}
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('utilization.settings.workDays')}
            </label>
            <div className="flex gap-1 mt-1">
              {DOW.map((d, i) => {
                const dow = i + 1;
                const active = selectedDays.has(dow);
                return (
                  <button key={dow} type="button"
                    onClick={() => canEdit && toggleDay(dow)}
                    disabled={!canEdit}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-glass)'}`,
                    }}>{d}</button>
                );
              })}
            </div>
          </div>

          {/* Error margin */}
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('utilization.settings.error')} ({t('utilization.settings.errorUnit')})
            </label>
            <input type="number" min="0" max="100" step="0.5"
              value={form.errorMarginPct ?? ''}
              disabled={!canEdit}
              onChange={e => setForm({ ...form, errorMarginPct: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
          </div>

          {/* Error note */}
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('utilization.settings.errorNote')}
            </label>
            <textarea rows={2}
              value={form.errorMarginNote || ''}
              disabled={!canEdit}
              onChange={e => setForm({ ...form, errorMarginNote: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
          </div>

          {canEdit && (
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Save size={14} />
              {saving ? '...' : t('utilization.settings.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Drill-down panel ─────────────────────────────────────────────────────

function DrillDownPanel({ open, date, data, entity, hourlyRate, currency, onClose }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  const dayRows = useMemo(() => {
    if (!data || !date) return [];
    return data.byEntity
      .map(e => {
        const d = (e.byDay || []).find(b => b.date === date);
        return d ? { ...d, id: e.id, name: e.name, type: e.type } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.loadPct ?? -1) - (a.loadPct ?? -1));
  }, [data, date]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] flex flex-col"
      style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-glass)' }}>
      <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('utilization.drillDown.title', { date })}
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:opacity-60"
          style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayRows.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('utilization.drillDown.noData')}
          </div>
        ) : dayRows.map(r => {
          const earned = (hourlyRate != null) ? Math.round(hourlyRate * (r.busy || 0)) : null;
          const idle = (r.shiftFund != null && r.busy != null) ? Math.max(0, r.shiftFund - r.busy) : null;
          const lost = (hourlyRate != null && idle != null) ? Math.round(hourlyRate * idle) : null;
          const histLink = entity === 'posts'
            ? `/post-history/${r.id}`
            : `/zone-history/${encodeURIComponent(r.name)}`;
          return (
            <div key={r.id} className="glass-static rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                <Link to={histLink} onClick={onClose}
                  className="text-[11px] underline" style={{ color: 'var(--accent)' }}>
                  {t('utilization.drillDown.openHistory')}
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>{t('utilization.table.shiftFund')}</div>
                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmtNumber(r.shiftFund)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>{t('utilization.table.busy')}</div>
                  <div className="font-bold" style={{ color: 'var(--accent)' }}>{fmtNumber(r.busy)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>{t('utilization.table.loadPct')}</div>
                  <div className="font-bold" style={{ color: 'var(--success)' }}>{r.loadPct ?? '—'}</div>
                </div>
                {hourlyRate != null && entity === 'posts' && (
                  <>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>{t('utilization.table.earned')}</div>
                      <div className="font-bold" style={{ color: 'var(--success)' }}>{fmtMoney(earned, currency)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>{t('utilization.table.lost')}</div>
                      <div className="font-bold" style={{ color: 'var(--danger)' }}>{fmtMoney(lost, currency)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────

export default function UtilizationReport() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const canEditSettings = hasPermission ? hasPermission('manage_settings') : false;

  // Period
  const [periodKey, setPeriodKey] = useState(searchParams.get('period') || '7d');
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') || '');
  const [customTo, setCustomTo] = useState(searchParams.get('to') || '');
  const [compare, setCompare] = useState(false);
  const [entity, setEntity] = useState(searchParams.get('entity') === 'zones' ? 'zones' : 'posts');

  // Data
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({
    workStart: '08:00', workEnd: '20:00', workDays: '1,2,3,4,5,6',
    hourlyRate: null, currency: '₽',
    errorMarginPct: null, errorMarginNote: null,
  });
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [drillDate, setDrillDate] = useState(null);

  // Computed dates
  const { from, to } = useMemo(() => {
    // <input type="date"> на каждое нажатие отдаёт промежуточные значения
    // (например, 0002-04-21 во время набора года). Принимаем только полностью
    // валидную ISO-дату с реалистичным годом, иначе откатываемся на periodKey.
    const isValidYmd = (s) => {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const y = parseInt(s.slice(0, 4), 10);
      return y >= 2000 && y <= 2100;
    };
    if (periodKey === 'custom' && isValidYmd(customFrom) && isValidYmd(customTo)) {
      const f = new Date(customFrom); f.setHours(0,0,0,0);
      const tt = new Date(customTo); tt.setHours(23,59,59,999);
      return { from: f, to: tt };
    }
    return periodFromKey(periodKey);
  }, [periodKey, customFrom, customTo]);

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        entity,
        compare: compare ? 'true' : 'false',
      });
      const [reportRes, settingsRes] = await Promise.all([
        api.get(`/api/reports/utilization?${params.toString()}`),
        api.get('/api/reports/utilization/settings'),
      ]);
      setData(reportRes.data);
      const s = settingsRes.data;
      setSettings({
        workStart: s.workStart || '08:00',
        workEnd: s.workEnd || '20:00',
        workDays: s.workDays || '1,2,3,4,5,6',
        hourlyRate: s.hourlyRate,
        currency: s.currency === 'RUB' ? '₽' : (s.currency || '₽'),
        errorMarginPct: s.errorMarginPct,
        errorMarginNote: s.errorMarginNote,
      });
    } catch (err) {
      console.error('UtilizationReport fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [api, from, to, entity, compare]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('entity', entity);
    if (periodKey === 'custom') {
      next.set('period', 'custom');
      if (customFrom) next.set('from', customFrom);
      if (customTo) next.set('to', customTo);
    } else {
      next.set('period', periodKey);
      next.delete('from'); next.delete('to');
    }
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, periodKey, customFrom, customTo]);

  // Save settings
  const saveSettings = async (patch) => {
    await api.put('/api/reports/utilization/settings', patch);
    await fetchData();
    setShowSettings(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const totals = data?.totals;
  const byEntity = data?.byEntity || [];
  const errorPct = data?.errorMargin?.pct;
  const errorNote = data?.errorMargin?.note;
  const hourlyRate = data?.hourlyRate;
  const currency = data?.currency === 'RUB' ? '₽' : (data?.currency || '₽');
  const isPosts = entity === 'posts';

  // Aggregated byDay across all entities — для хитмапа
  const aggregatedByDay = useMemo(() => {
    const map = new Map();
    for (const e of byEntity) {
      for (const d of (e.byDay || [])) {
        const cur = map.get(d.date) || { date: d.date, shiftFund: 0, busy: 0 };
        cur.shiftFund += d.shiftFund || 0;
        cur.busy += d.busy || 0;
        map.set(d.date, cur);
      }
    }
    const arr = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    return arr.map(x => ({
      ...x,
      shiftFund: Math.round(x.shiftFund * 10) / 10,
      busy: Math.round(x.busy * 10) / 10,
      loadPct: x.shiftFund > 0 ? Math.round((x.busy / x.shiftFund) * 100) : null,
    }));
  }, [byEntity]);

  const top3Loss = useMemo(() => {
    if (!isPosts) return [];
    return [...byEntity]
      .filter(e => (e.lost ?? 0) > 0)
      .sort((a, b) => (b.lost ?? 0) - (a.lost ?? 0))
      .slice(0, 3);
  }, [byEntity, isPosts]);

  // Compare deltas
  const compareTotals = data?.compare?.totals;
  const deltaPct = useCallback((field) => {
    if (!compareTotals || compareTotals[field] == null) return null;
    const cur = totals?.[field] ?? 0;
    const prev = compareTotals[field];
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }, [totals, compareTotals]);

  const busyRange = pctRange(totals?.busy, errorPct);
  const lostRange = pctRange(totals?.lost, errorPct);
  const earnedRange = pctRange(totals?.earned, errorPct);

  // ── Export ──────────────────────────────────────────────────────────────
  const exportXlsx = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = [{
      [isRu ? 'Период с' : 'From']: data.period.from,
      [isRu ? 'Период по' : 'To']: data.period.to,
      [isRu ? 'Сущности' : 'Entity']: entity,
      [isRu ? 'Раб. фонд, ч' : 'Fund, h']: totals?.shiftFund,
      [isRu ? 'Занятость, ч' : 'Busy, h']: totals?.busy,
      [isRu ? 'Простой, ч' : 'Idle, h']: totals?.idle,
      [isRu ? 'Загрузка, %' : 'Load, %']: totals?.loadPct,
      ...(isPosts ? {
        [isRu ? 'Ставка, ₽/ч' : 'Rate']: hourlyRate ?? '',
        [isRu ? 'Потенциал' : 'Potential']: totals?.potential,
        [isRu ? 'Заработано' : 'Earned']: totals?.earned,
        [isRu ? 'Потери' : 'Lost']: totals?.lost,
      } : {}),
      [isRu ? 'Погрешность ±%' : 'Margin ±%']: errorPct ?? '',
      [isRu ? 'Примечание' : 'Note']: errorNote ?? '',
    }];
    const ws1 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws1, isRu ? 'Сводка' : 'Summary');

    // Sheet 2: By entity
    const rows = byEntity.map(e => ({
      [isRu ? '#' : '#']: e.number ?? '',
      [isRu ? 'Имя' : 'Name']: e.name,
      [isRu ? 'Тип' : 'Type']: e.type ? t(`posts.${e.type}`, e.type) : '',
      [isRu ? 'Раб. фонд, ч' : 'Fund, h']: e.shiftFund,
      [isRu ? 'Занят., ч' : 'Busy, h']: e.busy,
      [isRu ? 'Простой, ч' : 'Idle, h']: e.idle,
      [isRu ? 'Загрузка, %' : 'Load, %']: e.loadPct,
      ...(isPosts ? {
        [isRu ? 'Заработано' : 'Earned']: e.earned,
        [isRu ? 'Потери' : 'Lost']: e.lost,
      } : {}),
    }));
    const ws2 = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws2, isPosts ? (isRu ? 'По постам' : 'Per post') : (isRu ? 'По зонам' : 'Per zone'));

    // Sheet 3: By day (aggregated)
    const dayRows = aggregatedByDay.map(d => ({
      [isRu ? 'Дата' : 'Date']: d.date,
      [isRu ? 'Раб. фонд, ч' : 'Fund, h']: d.shiftFund,
      [isRu ? 'Занят., ч' : 'Busy, h']: d.busy,
      [isRu ? 'Загрузка, %' : 'Load, %']: d.loadPct,
    }));
    const ws3 = XLSX.utils.json_to_sheet(dayRows);
    XLSX.utils.book_append_sheet(wb, ws3, isRu ? 'По дням' : 'Per day');

    const name = `utilization-${entity}-${isoDate(from)}-${isoDate(to)}.xlsx`;
    XLSX.writeFile(wb, name);
  };

  const exportPng = async () => {
    const el = document.getElementById('utilization-trend-chart');
    if (!el) return;
    const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `utilization-trend-${entity}-${isoDate(from)}.png`;
    a.click();
  };

  const exportPdf = async () => {
    if (!data) return;
    await exportUtilizationPdf({
      from, to, entity, isPosts, isRu,
      totals, byEntity, aggregatedByDay,
      hourlyRate, currency,
      errorPct, errorNote,
      deltaPct,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const PERIOD_OPTIONS = [
    { key: 'today',     label: t('utilization.period.today') },
    { key: 'yesterday', label: t('utilization.period.yesterday') },
    { key: '7d',        label: t('utilization.period.7d') },
    { key: '30d',       label: t('utilization.period.30d') },
    { key: 'custom',    label: t('utilization.period.custom') },
  ];

  return (
    <div className="p-4 space-y-3" id="utilization-report-root">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('utilization.title')}
          </h1>
          <HelpButton pageKey="utilization" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            <SettingsIcon size={12} />
            {hourlyRate != null ? `${fmtMoney(hourlyRate, currency)}/ч` : t('utilization.settings.rate')}
            {' · '}
            ±{errorPct ?? 0}%
          </button>
          <button onClick={fetchData}
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportXlsx} title={t('utilization.export.xlsx')}
            className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            <Download size={12} /> XLSX
          </button>
          <button onClick={exportPdf} title={t('utilization.export.pdf')}
            className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            <FileText size={12} /> PDF
          </button>
          <button onClick={exportPng} title={t('utilization.export.png')}
            className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)' }}>
            <ImageIcon size={12} /> PNG
          </button>
        </div>
      </div>

      {/* Filters: period + entity tabs + compare */}
      <div className="glass-static rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <div className="flex gap-1 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setPeriodKey(opt.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: periodKey === opt.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: periodKey === opt.key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${periodKey === opt.key ? 'var(--accent)' : 'var(--border-glass)'}`,
                }}>{opt.label}</button>
            ))}
          </div>
          {periodKey === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} />
            </div>
          )}
          <div className="flex-1" />
          <label className="text-xs flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
            {t('utilization.compare')}
          </label>
        </div>
        <div className="flex gap-1">
          {[
            { key: 'posts', label: t('utilization.tabs.posts'), icon: Layers },
            { key: 'zones', label: t('utilization.tabs.zones'), icon: Building2 },
          ].map(tab => (
            <button key={tab.key} onClick={() => setEntity(tab.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
              style={{
                background: entity === tab.key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: entity === tab.key ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${entity === tab.key ? 'var(--accent)' : 'var(--border-glass)'}`,
              }}>
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="glass-static rounded-xl p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={18} className="animate-spin inline mr-2" />
          {t('utilization.loading')}
        </div>
      )}

      {/* KPI operational */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <KpiCard icon={Clock} label={t('utilization.kpi.shiftFund')}
            value={fmtNumber(totals?.shiftFund)} unit={isRu ? 'ч' : 'h'} color="var(--accent)"
            deltaPct={deltaPct('shiftFund')} />
          <KpiCard icon={Clock} label={t('utilization.kpi.busy')}
            value={fmtNumber(totals?.busy)} unit={isRu ? 'ч' : 'h'} color="var(--success)"
            sub={busyRange ? `${fmtNumber(busyRange.low)} – ${fmtNumber(busyRange.high)}` : null}
            deltaPct={deltaPct('busy')} />
          <KpiCard icon={Percent} label={t('utilization.kpi.loadPct')}
            value={totals?.loadPct != null ? `${totals.loadPct}` : '—'} unit="%" color="var(--warning)"
            sub={errorPct != null ? `±${errorPct} ${isRu ? 'п.п.' : 'pp'}` : null}
            deltaPct={deltaPct('loadPct')} />
        </div>
      )}

      {/* KPI financial — только для постов */}
      {data && isPosts && hourlyRate != null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <KpiCard icon={Wallet} label={t('utilization.kpi.potential')}
            value={fmtMoney(totals?.potential, currency)} color="var(--text-secondary)" />
          <KpiCard icon={Coins} label={t('utilization.kpi.earned')}
            value={fmtMoney(totals?.earned, currency)} color="var(--success)"
            sub={earnedRange ? `${fmtMoney(earnedRange.low, currency)} – ${fmtMoney(earnedRange.high, currency)}` : null} />
          <KpiCard icon={TrendingDown} label={t('utilization.kpi.lost')}
            value={fmtMoney(totals?.lost, currency)} color="var(--danger)"
            sub={lostRange ? `${fmtMoney(lostRange.low, currency)} – ${fmtMoney(lostRange.high, currency)}` : null} />
        </div>
      )}

      {/* Heatmap */}
      {data && aggregatedByDay.length > 0 && (
        <UtilizationHeatmap
          byDay={aggregatedByDay}
          onSelectDate={setDrillDate}
          currency={currency}
          hourlyRate={hourlyRate}
        />
      )}

      {/* Top losses — только посты */}
      {data && isPosts && top3Loss.length > 0 && (
        <div className="glass-static rounded-xl p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
            {t('utilization.top.title')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {top3Loss.map(p => (
              <div key={p.id} className="rounded-lg p-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  <span className="text-sm font-mono font-bold" style={{ color: 'var(--danger)' }}>
                    {fmtMoney(p.lost, currency)}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('utilization.top.loss')}: {fmtNumber(p.idle)} {isRu ? 'ч' : 'h'} × {fmtMoney(hourlyRate, currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {data && byEntity.length > 0 && (
        <div className="glass-static rounded-xl overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' }}>
            {isPosts ? t('utilization.table.title') : t('utilization.table.titleZones')}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="px-2 py-1.5 text-left" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.number')}</th>
                  <th className="px-2 py-1.5 text-left" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.name')}</th>
                  <th className="px-2 py-1.5 text-left" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.type')}</th>
                  <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.shiftFund')}</th>
                  <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.busy')}</th>
                  <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.idle')}</th>
                  <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.loadPct')}</th>
                  {isPosts && hourlyRate != null && (
                    <>
                      <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.earned')}</th>
                      <th className="px-2 py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{t('utilization.table.lost')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {byEntity.map((e, idx) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-glass)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{e.number ?? '—'}</td>
                    <td className="px-2 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {isPosts && e.id ? (
                        <Link to={`/post-history/${e.id}`} className="hover:underline" style={{ color: 'var(--text-primary)' }}>{e.name}</Link>
                      ) : !isPosts ? (
                        <Link to={`/zone-history/${encodeURIComponent(e.name)}`} className="hover:underline" style={{ color: 'var(--text-primary)' }}>{e.name}</Link>
                      ) : e.name}
                    </td>
                    <td className="px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>{e.type ? t(`posts.${e.type}`, e.type) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmtNumber(e.shiftFund)}</td>
                    <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--accent)' }}>{fmtNumber(e.busy)}</td>
                    <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{fmtNumber(e.idle)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold"
                        style={{
                          background: e.loadPct >= 90 ? 'rgba(16,185,129,0.2)'
                                    : e.loadPct >= 70 ? 'rgba(34,197,94,0.15)'
                                    : e.loadPct >= 50 ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(148,163,184,0.15)',
                          color: e.loadPct >= 70 ? 'var(--success)' : e.loadPct >= 50 ? 'var(--warning)' : 'var(--text-secondary)',
                        }}>{e.loadPct != null ? `${e.loadPct}%` : '—'}</span>
                    </td>
                    {isPosts && hourlyRate != null && (
                      <>
                        <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--success)' }}>{fmtMoney(e.earned, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--danger)' }}>{fmtMoney(e.lost, currency)}</td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Totals */}
                <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                  <td className="px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>Σ</td>
                  <td className="px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>{t('utilization.table.total')}</td>
                  <td></td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{fmtNumber(totals?.shiftFund)}</td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--accent)' }}>{fmtNumber(totals?.busy)}</td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{fmtNumber(totals?.idle)}</td>
                  <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--success)' }}>{totals?.loadPct != null ? `${totals.loadPct}%` : '—'}</td>
                  {isPosts && hourlyRate != null && (
                    <>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--success)' }}>{fmtMoney(totals?.earned, currency)}</td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--danger)' }}>{fmtMoney(totals?.lost, currency)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend chart */}
      {data && aggregatedByDay.length > 0 && (
        <div className="glass-static rounded-xl p-3" id="utilization-trend-chart">
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('utilization.trend.title')}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={aggregatedByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                label={{ value: t('utilization.trend.hoursAxis'), angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 100]}
                label={{ value: t('utilization.trend.pctAxis'), angle: 90, position: 'insideRight', fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 11 }} />
              <RLegend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="busy" fill="rgba(99,102,241,0.7)" name={isRu ? 'Занятость, ч' : 'Busy, h'} />
              <Bar yAxisId="left" dataKey="shiftFund" fill="rgba(148,163,184,0.3)" name={isRu ? 'Раб. фонд, ч' : 'Fund, h'} />
              <Line yAxisId="right" type="monotone" dataKey="loadPct" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name={isRu ? 'Загрузка, %' : 'Load, %'} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Error notice */}
      {data && errorPct != null && (
        <div className="text-[11px] flex items-start gap-1.5 px-2"
          style={{ color: 'var(--text-muted)' }}>
          <AlertTriangle size={12} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <span>
            {t('utilization.errorNotice', { pct: errorPct })}
            {errorNote && ` ${errorNote}`}
          </span>
        </div>
      )}

      {/* Empty state */}
      {data && byEntity.length === 0 && !loading && (
        <div className="glass-static rounded-xl p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('utilization.empty')}
        </div>
      )}

      {/* Modals */}
      <SettingsModal open={showSettings} settings={settings} onClose={() => setShowSettings(false)} onSave={saveSettings} canEdit={canEditSettings} />
      <DrillDownPanel open={!!drillDate} date={drillDate} data={data} entity={entity}
        hourlyRate={hourlyRate} currency={currency} onClose={() => setDrillDate(null)} />
    </div>
  );
}
