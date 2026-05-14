// Страница «Сопоставления» — единая точка входа для разных типов матчинга.
//
// Архитектура: тонкая шапка как у Data1C + тaб-бар. Каждый таб — самостоятельный
// компонент. Сейчас активен один (ЗН ↔ Заявки 1С), остальные — заглушки.
// Источник данных активного таба: GET /api/oneC/matching.

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitMerge, ClipboardList, Camera, Activity, Wrench,
  Search, ChevronDown, ChevronRight,
  AlertTriangle, GitBranch,
  CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import HelpButton from '../components/HelpButton';

// ---------- helpers ----------

function fmtDt(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Возвращают null, если значения нет. На месте «нет данных» вызов-сайт
// подставляет локализованный плейсхолдер `t('orderMatching.noData')` («н/д»/«n/a»),
// чтобы не путать «нет данных» с типографским минусом «−».
function fmtSignedSec(sec) {
  if (sec == null) return null;
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sign = sec > 0 ? '+' : sec < 0 ? '−' : '';
  if (h > 0) return `${sign}${h}ч ${m}м`;
  return `${sign}${m}м`;
}

function fmtDurationSec(sec) {
  if (sec == null) return null;
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

const SEVERITY_COLORS = {
  gray:   { bg: 'transparent',            fg: 'var(--text)' },
  green:  { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e' },
  yellow: { bg: 'rgba(234,179,8,0.18)',   fg: '#eab308' },
  orange: { bg: 'rgba(249,115,22,0.20)',  fg: '#f97316' },
  red:    { bg: 'rgba(239,68,68,0.22)',   fg: '#ef4444' },
};

const MATCH_BADGES = {
  matched:                  { icon: CheckCircle2, color: '#22c55e', key: 'badge.matched' },
  matched_vehicle_mismatch: { icon: AlertTriangle, color: '#eab308', key: 'badge.vehicleMismatch' },
  no_basis:                 { icon: MinusCircle,  color: 'var(--text-muted)', key: 'badge.noBasis' },
  basis_not_found:          { icon: XCircle,      color: '#ef4444', key: 'badge.basisNotFound' },
};

function MatchBadge({ status, t }) {
  const b = MATCH_BADGES[status];
  if (!b) return null;
  const Icon = b.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] whitespace-nowrap"
      style={{ background: 'var(--card-bg)', color: b.color, border: `1px solid ${b.color}40` }}>
      <Icon className="w-3 h-3" />
      {t(`orderMatching.${b.key}`)}
    </span>
  );
}

// Возвращает строку с описанием авто, либо null — если ничего полезного нет.
// Плейсхолдер «н/д» подставляется на месте использования.
function vehicleString(item) {
  const parts = [item.brand, item.model].filter(Boolean).join(' ');
  const subParts = [item.plateNumber1 || item.plateNumber2, item.vin].filter(Boolean);
  if (parts) return `${parts}${subParts.length ? ' · ' + subParts.join(' / ') : ''}`;
  if (item.vehicleText) return item.vehicleText;
  return subParts.join(' / ') || null;
}

// 3-строчная ячейка моментов (план/уточн/факт) с подсветкой
function MomentCell({ planVal, uchnVal, factVal, uchnSev, factSev, t }) {
  const noData = t('orderMatching.noData');
  const cPlan = SEVERITY_COLORS.gray;
  const cUchn = SEVERITY_COLORS[uchnSev] || SEVERITY_COLORS.gray;
  const cFact = SEVERITY_COLORS[factSev] || SEVERITY_COLORS.gray;
  const Row = ({ label, val, c }) => {
    const hasData = !!fmtDt(val);
    return (
      <div className="flex items-baseline gap-2 px-1 rounded whitespace-nowrap leading-tight"
        style={{ background: c.bg }}>
        <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-[11px] font-mono"
          style={{ color: hasData ? c.fg : 'var(--text-muted)', opacity: hasData ? 1 : 0.6 }}>
          {hasData ? fmtDt(val) : noData}
        </span>
      </div>
    );
  };
  return (
    <div className="space-y-0.5">
      <Row label={t('orderMatching.row.plan')}  val={planVal} c={cPlan} />
      <Row label={t('orderMatching.row.uchn')}  val={uchnVal} c={cUchn} />
      <Row label={t('orderMatching.row.fact')}  val={factVal} c={cFact} />
    </div>
  );
}

// Δ ячейка длительности (со знаком и подсветкой)
function DeltaCell({ deltaSec, severity, noData }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.gray;
  const formatted = fmtSignedSec(deltaSec);
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap"
      style={{
        background: c.bg,
        color: formatted == null ? 'var(--text-muted)' : c.fg,
        opacity: formatted == null ? 0.6 : 1,
      }}>
      {formatted ?? noData}
    </span>
  );
}

// ---------- табы ----------

// Описание табов: id, иконка, i18n-ключ. Component — рендерится при активации.
// Новые типы матчинга добавляются сюда; страница больше ничего не правит.
const MATCHING_TABS = [
  { id: 'zn_plan',            icon: GitMerge,      Component: TabZnPlanMatching },
  { id: 'closed_zn_orders',   icon: ClipboardList, Component: TabPlaceholder },
  { id: 'closed_zn_cv',       icon: Camera,        Component: TabPlaceholder },
  { id: 'payroll',            icon: Wrench,        Component: TabPlaceholder },
];

// ---------- root ----------

export default function OrderMatching() {
  const { t } = useTranslation();
  const [active, setActive] = useState('zn_plan');

  const ActiveComponent = (MATCHING_TABS.find((tab) => tab.id === active) || MATCHING_TABS[0]).Component;

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 border-b" style={{ borderColor: 'var(--border-glass)' }}>
        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          <h1 className="text-sm font-bold flex items-center gap-1.5 whitespace-nowrap pr-2"
              style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-glass)' }}>
            <Activity size={14} /> {t('orderMatching.title')}
          </h1>
          <div className="flex gap-1">
            {MATCHING_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              const isStub = tab.Component === TabPlaceholder;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className="px-3 py-1.5 text-sm flex items-center gap-1.5 transition-all whitespace-nowrap relative"
                  style={{
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: isActive ? 600 : 500,
                    opacity: isStub && !isActive ? 0.55 : 1,
                  }}
                >
                  <Icon size={14} /> {t(`orderMatching.tabs.${tab.id}`)}
                  {isStub && (
                    <span className="inline-flex items-center justify-center rounded text-[9px] font-semibold px-1"
                      style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {t('orderMatching.soon')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <HelpButton pageKey="orderMatching" />
      </div>

      <div>
        <ActiveComponent t={t} tabId={active} />
      </div>
    </div>
  );
}

// ---------- TAB: ЗН ↔ Заявки 1С ----------

function TabZnPlanMatching({ t }) {
  const { api } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const [q, setQ] = useState('');
  const [matchStatus, setMatchStatus] = useState([]);
  const [minSeverity, setMinSeverity] = useState('');
  const [stateFilter, setStateFilter] = useState([]);
  const [page, setPage] = useState(0);
  const TAKE = 100;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('take', String(TAKE));
    params.set('skip', String(page * TAKE));
    if (q.trim()) params.set('q', q.trim());
    if (matchStatus.length) params.set('matchStatus', matchStatus.join(','));
    if (minSeverity) params.set('minSeverity', minSeverity);
    if (stateFilter.length) params.set('state', stateFilter.join(','));

    api.get(`/api/oneC/matching?${params.toString()}`)
      .then((res) => {
        const data = res && res.data ? res.data : {};
        setItems(data.items || []);
        setTotal(data.total || 0);
        setKpi(data.kpi || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, matchStatus.join(','), minSeverity, stateFilter.join(','), page, api]);

  const stateOptions = Array.from(new Set(items.map((it) => it.state).filter(Boolean))).sort();

  function toggleExpanded(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleMulti(setter, value, current) {
    if (current.includes(value)) setter(current.filter((x) => x !== value));
    else setter([...current, value]);
  }
  function resetFilters() {
    setQ(''); setMatchStatus([]); setMinSeverity(''); setStateFilter([]); setPage(0);
  }

  // KPI как кликабельные chip-фильтры: тот же ряд = и счётчик, и фильтр.
  const kpiChips = kpi ? [
    { id: 'total', label: t('orderMatching.kpi.total'), value: kpi.total, color: 'var(--text)', active: matchStatus.length === 0 && !minSeverity, onClick: () => { setMatchStatus([]); setMinSeverity(''); setPage(0); } },
    { id: 'matched', label: t('orderMatching.kpi.matched'), value: kpi.matched, color: '#22c55e', active: matchStatus.includes('matched'), onClick: () => { toggleMulti(setMatchStatus, 'matched', matchStatus); setPage(0); } },
    { id: 'noBasis', label: t('orderMatching.kpi.noBasis'), value: kpi.noBasis, color: 'var(--text-muted)', active: matchStatus.includes('no_basis'), onClick: () => { toggleMulti(setMatchStatus, 'no_basis', matchStatus); setPage(0); } },
    { id: 'basisNotFound', label: t('orderMatching.kpi.basisNotFound'), value: kpi.basisNotFound, color: '#ef4444', active: matchStatus.includes('basis_not_found'), onClick: () => { toggleMulti(setMatchStatus, 'basis_not_found', matchStatus); setPage(0); } },
    { id: 'severity', label: t('orderMatching.kpi.severityOrangeOrRed'), value: kpi.severityOrangeOrRed, color: '#f97316', active: minSeverity === 'orange', onClick: () => { setMinSeverity(minSeverity === 'orange' ? '' : 'orange'); setPage(0); } },
  ] : [];

  return (
    <div className="space-y-2">
      {/* KPI как фильтр-чипы (один ряд) */}
      {kpi && (
        <div className="flex flex-wrap gap-1.5">
          {kpiChips.map((c) => (
            <button key={c.id} onClick={c.onClick}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-all backdrop-blur-md"
              style={{
                background: c.active ? 'var(--accent)' : 'var(--bg-glass)',
                color: c.active ? '#fff' : 'var(--text-muted)',
                border: '1px solid ' + (c.active ? 'var(--accent)' : 'var(--border-glass)'),
                boxShadow: c.active ? '0 4px 12px rgba(124,58,237,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
              }}>
              <span>{c.label}</span>
              <span className="font-semibold" style={{ color: c.active ? '#fff' : c.color }}>{c.value}</span>
            </button>
          ))}
        </div>
      )}

      {/* Поиск + фильтры одной строкой */}
      <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl backdrop-blur-md"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={t('orderMatching.searchPlaceholder')}
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('orderMatching.minSeverity')}:</span>
          {['','yellow','orange','red'].map((s) => (
            <ChipToggle key={s||'all'} active={minSeverity === s}
              onClick={() => { setMinSeverity(s); setPage(0); }}
              label={s ? t(`orderMatching.severity.${s}`) : t('orderMatching.severity.all')} />
          ))}
        </div>

        {stateOptions.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('orderMatching.state')}:</span>
            {stateOptions.map((s) => (
              <ChipToggle key={s} active={stateFilter.includes(s)}
                onClick={() => { toggleMulti(setStateFilter, s, stateFilter); setPage(0); }}
                label={s} />
            ))}
          </div>
        )}

        <button onClick={resetFilters} className="px-2 py-1 text-[11px] rounded"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {t('orderMatching.resetFilters')}
        </button>
      </div>

      <div className="rounded-xl overflow-hidden backdrop-blur-md"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        <div className="px-3 py-1.5 flex items-center justify-between text-[11px]" style={{ borderBottom: '1px solid var(--border-glass)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('orderMatching.rowsCount', { count: total })}</span>
          {loading && <span style={{ color: 'var(--text-muted)' }}>…</span>}
          {error && <span style={{ color: '#ef4444' }}>{error}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--bg)' }}>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="w-8"></th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.vehicle')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.orderNumber')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.state')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.basis')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.match')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.start')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.end')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.dPlan')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.dUchn')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.master')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.col.dispatcher')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <RowAndDetail key={it.id} item={it}
                  isExpanded={expanded.has(it.id)}
                  onToggle={() => toggleExpanded(it.id)}
                  t={t} />
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={12} className="text-center px-4 py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('orderMatching.empty')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > TAKE && (
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--border-glass)' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {page * TAKE + 1}–{Math.min((page + 1) * TAKE, total)} / {total}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1 rounded disabled:opacity-30"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>‹</button>
              <button disabled={(page + 1) * TAKE >= total} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded disabled:opacity-30"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- TAB: заглушка для будущих типов матчинга ----------

function TabPlaceholder({ t, tabId }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 rounded-xl backdrop-blur-md"
      style={{ background: 'var(--bg-glass)', border: '1px dashed var(--border-glass)', color: 'var(--text-muted)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <Wrench className="w-8 h-8 mb-2 opacity-50" />
      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {t(`orderMatching.tabs.${tabId}`)}
      </div>
      <div className="text-xs mt-1">{t('orderMatching.placeholder.notReady')}</div>
    </div>
  );
}

// ---------- subcomponents ----------

function ChipToggle({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className="px-2 py-0.5 rounded text-[11px]"
      style={{
        background: active ? 'var(--accent)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
      }}>
      {label}
    </button>
  );
}

function RowAndDetail({ item, isExpanded, onToggle, t }) {
  const canExpand = item.hasHistory;
  const d = item.dates || {};
  const sev = d.sev || {};
  const dur = item.durations || {};
  const noData = t('orderMatching.noData');
  // Локализованный плейсхолдер «н/д»; показывается серым с пониженной прозрачностью,
  // чтобы визуально не конкурировать с минусом «−» в подсказках длительности.
  const NoData = () => <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>;
  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: isExpanded ? 'var(--bg)' : 'transparent' }}>
        <td className="px-2 py-2 text-center align-top">
          {canExpand ? (
            <button onClick={onToggle} style={{ color: 'var(--text-muted)' }}>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : null}
        </td>
        <td className="px-3 py-2 align-top">
          <div>{vehicleString(item) || <NoData />}</div>
          {item.hasHistory && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px]" style={{ color: '#a855f7' }}>
              <GitBranch className="w-3 h-3" />
              {t('orderMatching.hasHistory', { count: (item.history || []).length })}
            </span>
          )}
        </td>
        <td className="px-3 py-2 font-mono whitespace-nowrap align-top">{item.orderNumber || <NoData />}</td>
        <td className="px-3 py-2 whitespace-nowrap align-top">{item.state || <NoData />}</td>
        <td className="px-3 py-2 align-top">
          <div className="text-xs whitespace-normal break-words leading-snug" style={{ minWidth: '260px', maxWidth: '320px' }} title={item.basis || ''}>
            {item.basis || <NoData />}
          </div>
          {item.planNumber && (
            <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              № {item.planNumber}
            </div>
          )}
        </td>
        <td className="px-3 py-2 align-top"><MatchBadge status={item.matchStatus} t={t} /></td>

        <td className="px-3 py-2 align-top">
          <MomentCell
            planVal={d.planStart}  uchnVal={d.uchnStart}  factVal={d.factStart}
            uchnSev={sev.uchnStartSev} factSev={sev.factStartSev}
            t={t}
          />
        </td>
        <td className="px-3 py-2 align-top">
          <MomentCell
            planVal={d.planEnd}    uchnVal={d.uchnEnd}    factVal={d.factEnd}
            uchnSev={sev.uchnEndSev} factSev={sev.factEndSev}
            t={t}
          />
        </td>

        <td className="px-3 py-2 align-top">
          <DeltaCell deltaSec={dur.deltaPlan} severity={dur.sevPlan} noData={noData} />
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('orderMatching.col.dPlanHint', { fact: fmtDurationSec(dur.tFact) ?? noData, plan: fmtDurationSec(dur.tPlan) ?? noData })}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <DeltaCell deltaSec={dur.deltaUchn} severity={dur.sevUchn} noData={noData} />
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('orderMatching.col.dUchnHint', { fact: fmtDurationSec(dur.tFact) ?? noData, uchn: fmtDurationSec(dur.tUchn) ?? noData })}
          </div>
        </td>

        <td className="px-3 py-2 text-xs align-top">{item.master || <NoData />}</td>
        <td className="px-3 py-2 text-xs align-top">{item.dispatcher || <NoData />}</td>
      </tr>

      {isExpanded && canExpand && (
        <tr style={{ background: 'var(--bg)', borderTop: '1px dashed var(--border)' }}>
          <td colSpan={12} className="px-6 py-3">
            <HistoryTable history={item.history || []} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

// 12 колонок «Заказ-наряды»; скрываем те, где значения совпадают у всех версий ЗН.
const HISTORY_COLS = [
  { key: 'vehicle',        i18n: 'data1c.raw.col.vehicle',           derive: (r) => vehicleString(r) },
  { key: 'orderNumber',    i18n: 'data1c.raw.col.orderNumberZN',     fmt: 'mono' },
  { key: 'state',          i18n: 'data1c.raw.col.state' },
  { key: 'repairKind',     i18n: 'data1c.raw.col.repairKind' },
  { key: 'workStartedAt',  i18n: 'data1c.raw.col.workStartFact',     fmt: 'dt' },
  { key: 'workFinishedAt', i18n: 'data1c.raw.col.workEndFact',       fmt: 'dt' },
  { key: 'closedAt',       i18n: 'data1c.raw.col.closedFact',        fmt: 'dt' },
  { key: 'basis',          i18n: 'data1c.raw.col.basis' },
  { key: 'basisStart',     i18n: 'data1c.raw.col.basisStartPlanned', fmt: 'dt' },
  { key: 'basisEnd',       i18n: 'data1c.raw.col.basisEndPlanned',   fmt: 'dt' },
  { key: 'master',         i18n: 'data1c.raw.col.master' },
  { key: 'dispatcher',     i18n: 'data1c.raw.col.dispatcher' },
];

function getCellValue(row, col) {
  if (col.derive) return col.derive(row);
  return row[col.key];
}
function fmtCell(val, fmt, noData) {
  if (val == null || val === '') return noData;
  if (fmt === 'dt') return fmtDt(val) || noData;
  return String(val);
}

function HistoryTable({ history, t }) {
  if (!history.length) return null;
  const noData = t('orderMatching.noData');

  // Скрываем колонки, у которых значения совпадают у всех версий
  const visibleCols = HISTORY_COLS.filter((col) => {
    const vals = history.map((s) => {
      const v = getCellValue(s, col);
      return v == null ? '' : String(v);
    });
    return new Set(vals).size > 1;
  });

  return (
    <div className="space-y-2">
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('orderMatching.detail.history', { count: history.length })}
      </div>
      {visibleCols.length === 0 ? (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('orderMatching.detail.allIdentical', { count: history.length })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead style={{ color: 'var(--text-muted)' }}>
              <tr>
                <th className="text-left px-2 py-1 whitespace-nowrap">{t('orderMatching.detail.receivedAt')}</th>
                {visibleCols.map((c) => (
                  <th key={c.key} className="text-left px-2 py-1 whitespace-nowrap">{t(c.i18n)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((s, idx) => (
                <tr key={s.id || idx}
                  style={{
                    borderTop: '1px solid var(--border)',
                    background: s.isLatest ? 'rgba(124,58,237,0.10)' : 'transparent',
                    color: s.isLatest ? 'var(--accent)' : undefined,
                  }}>
                  <td className="px-2 py-1 whitespace-nowrap font-mono text-[11px]">
                    {fmtDt(s.receivedAt) || noData}
                    {s.isLatest && (
                      <span className="ml-1 text-[9px] uppercase" style={{ color: 'var(--accent)' }}>
                        {t('orderMatching.detail.latest')}
                      </span>
                    )}
                  </td>
                  {visibleCols.map((c) => {
                    const v = getCellValue(s, c);
                    return (
                      <td key={c.key} className={'px-2 py-1 whitespace-nowrap' + (c.fmt === 'mono' ? ' font-mono' : '')}>
                        {fmtCell(v, c.fmt, noData)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
