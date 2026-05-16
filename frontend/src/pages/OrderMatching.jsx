// Страница «Сопоставления» — единая точка входа для разных типов матчинга.
//
// Архитектура: тонкая шапка как у Data1C + тaб-бар. Каждый таб — самостоятельный
// компонент. Сейчас активен один (ЗН ↔ Заявки 1С), остальные — заглушки.
// Источник данных активного таба: GET /api/oneC/matching.

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GitMerge, ClipboardList, Camera, Activity, Wrench,
  Search, ChevronDown, ChevronRight,
  AlertTriangle, GitBranch,
  CheckCircle2, XCircle, MinusCircle,
  TrendingUp, TrendingDown,
  ArrowUp, ArrowDown, ArrowUpDown,
  Users, Hourglass, ListChecks, BarChart3,
  RefreshCw, UserCog, Briefcase,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import HelpButton from '../components/HelpButton';
import Pagination from '../components/Pagination';
import PeriodPresets from '../components/data1c/PeriodPresets';
import KpiCard from '../components/data1c/KpiCard';
import RepairKindChips from '../components/data1c/RepairKindChips';
import useTableSort from '../hooks/useTableSort';
import { getAppTimezone } from '../utils/appTimezone';

// ---------- helpers ----------

function fmtDt(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', { timeZone: getAppTimezone(), day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  { id: 'closed_zn_orders',   icon: ClipboardList, Component: TabClosedZnOrders },
  { id: 'closed_zn_cv',       icon: Camera,        Component: TabClosedZnCv },
  { id: 'payroll',            icon: Wrench,        Component: TabPayroll },
];

// ---------- root ----------

export default function OrderMatching() {
  const { t } = useTranslation();
  const [active, setActive] = useState('zn_plan');
  // Кросс-табная навигация: клик по № ЗН в одной вкладке → переход на другую
  // с фильтрацией+подсветкой строки. Передаём вниз `navigateTo(tabId, orderNumber)`;
  // дочерний таб получает `focusOrderNumber` только когда он стал активным.
  const [focusOrderNumber, setFocusOrderNumber] = useState(null);
  function navigateTo(tabId, orderNumber) {
    setActive(tabId);
    setFocusOrderNumber(orderNumber || null);
  }

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
        <HelpButton pageKey="orderMatching" tabId={active} />
      </div>

      <div>
        <ActiveComponent t={t} tabId={active} navigateTo={navigateTo}
          focusOrderNumber={focusOrderNumber}
          clearFocus={() => setFocusOrderNumber(null)} />
      </div>
    </div>
  );
}

// ---------- TAB: ЗН ↔ Заявки 1С ----------

function TabZnPlanMatching({ t, focusOrderNumber, clearFocus }) {
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
  const [perPage, setPerPage] = useState(50);
  // По умолчанию — самая новая дата окончания (факт → уточн → план).
  // Бэкенд понимает sortBy=endAny|startAny|orderNumber|state|master|dispatcher|
  // matchStatus|deltaPlan|deltaUchn.
  const [sortBy, setSortBy] = useState('endAny');
  const [sortDir, setSortDir] = useState('desc');

  // Кросс-табный фокус: при переходе с «Закр. ЗН» подставляем номер ЗН в поиск,
  // сбрасываем остальные фильтры, и после загрузки скроллим/подсвечиваем строку.
  const [highlightOrder, setHighlightOrder] = useState(null);
  const rowRefs = useRef({});
  useEffect(() => {
    if (!focusOrderNumber) return;
    setQ(focusOrderNumber);
    setMatchStatus([]); setMinSeverity(''); setStateFilter([]); setPage(0);
    setHighlightOrder(focusOrderNumber);
    if (clearFocus) clearFocus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOrderNumber]);
  useEffect(() => {
    if (!highlightOrder || loading) return;
    const el = rowRefs.current[highlightOrder];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Подсветка живёт ~2.5с, потом сама гаснет.
    const tm = setTimeout(() => setHighlightOrder(null), 2500);
    return () => clearTimeout(tm);
  }, [highlightOrder, loading, items]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('take', String(perPage));
    params.set('skip', String(page * perPage));
    if (q.trim()) params.set('q', q.trim());
    if (matchStatus.length) params.set('matchStatus', matchStatus.join(','));
    if (minSeverity) params.set('minSeverity', minSeverity);
    if (stateFilter.length) params.set('state', stateFilter.join(','));
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);

    api.get(`/api/oneC/matching?${params.toString()}`)
      .then((res) => {
        const data = res && res.data ? res.data : {};
        setItems(data.items || []);
        setTotal(data.total || 0);
        setKpi(data.kpi || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, matchStatus.join(','), minSeverity, stateFilter.join(','), page, perPage, sortBy, sortDir, api]);

  // Клик по заголовку: тот же столбец → инверсия dir; новый → desc по умолчанию,
  // кроме текстовых (orderNumber/state/master/dispatcher/matchStatus) — для них asc.
  function onSort(key) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      const textKeys = ['orderNumber', 'state', 'master', 'dispatcher', 'matchStatus'];
      setSortDir(textKeys.includes(key) ? 'asc' : 'desc');
    }
    setPage(0);
  }

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
                <SortableTh sortKey="orderNumber" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.orderNumber')}</SortableTh>
                <SortableTh sortKey="state"       sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.state')}</SortableTh>
                <th className="text-left px-3 py-2">{t('orderMatching.col.basis')}</th>
                <SortableTh sortKey="matchStatus" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.match')}</SortableTh>
                <SortableTh sortKey="startAny"    sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.start')}</SortableTh>
                <SortableTh sortKey="endAny"      sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.end')}</SortableTh>
                <SortableTh sortKey="deltaPlan"   sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.dPlan')}</SortableTh>
                <SortableTh sortKey="deltaUchn"   sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.dUchn')}</SortableTh>
                <SortableTh sortKey="master"      sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.master')}</SortableTh>
                <SortableTh sortKey="dispatcher"  sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.col.dispatcher')}</SortableTh>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <RowAndDetail key={it.id} item={it}
                  isExpanded={expanded.has(it.id)}
                  onToggle={() => toggleExpanded(it.id)}
                  highlight={highlightOrder && it.orderNumber === highlightOrder}
                  rowRef={(el) => { if (it.orderNumber) rowRefs.current[it.orderNumber] = el; }}
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

        <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          <Pagination
            page={page + 1}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            totalItems={total}
            perPage={perPage}
            perPageOptions={[25, 50, 100]}
            onPageChange={(p) => setPage(p - 1)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(0); }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- TAB: Закр. ЗН ↔ Заказ-наряды и Заявки ----------
//
// База — «Закрытые ЗН» (deduped performed). К каждой строке backend подтягивает
// длительности из repair/plan: Δплан, Δуточн, Δфакт, Δзакр−факт.
// Цвета фона колонок отличают семантику (нормо vs 4 разницы), но НЕ зависят
// от severity — это самостоятельные «жёсткие» цвета.
// Подсветка строки: |Δфакт − нормочасы| / нормочасы > 30%.

const CLOSED_COL_BG = {
  norm:    'rgba(124, 58, 237, 0.10)', // violet — нормочасы (эталон)
  dPlan:   'rgba(56, 189, 248, 0.10)', // sky    — Δ план
  dUchn:   'rgba(234, 179, 8, 0.10)',  // amber  — Δ уточн
  dFact:   'rgba(34, 197, 94, 0.10)',  // emerald — Δ факт
  dClosed: 'rgba(244, 114, 182, 0.10)',// pink   — Δ закр−факт
};
const CLOSED_COL_HEADER = {
  norm:    '#a78bfa',
  dPlan:   '#38bdf8',
  dUchn:   '#eab308',
  dFact:   '#22c55e',
  dClosed: '#f472b6',
};

// Длительность в часах с одной десятой: 3540сек → "0.98ч". null → null.
function fmtHoursSec(sec) {
  if (sec == null) return null;
  const h = sec / 3600;
  return `${h.toFixed(h < 10 ? 2 : 1)}ч`;
}
function fmtHoursNumber(h) {
  if (h == null) return null;
  return `${Number(h).toFixed(Number(h) < 10 ? 2 : 1)}ч`;
}

function TabClosedZnOrders({ t, navigateTo }) {
  const { api } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState(null);
  const [threshold, setThreshold] = useState(0.3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [q, setQ] = useState('');
  const [onlyMismatch, setOnlyMismatch] = useState(false);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(50);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('take', String(perPage));
    params.set('skip', String(page * perPage));
    if (q.trim()) params.set('q', q.trim());
    if (onlyMismatch) params.set('onlyMismatch', '1');

    api.get(`/api/oneC/matching/closed?${params.toString()}`)
      .then((res) => {
        const data = res && res.data ? res.data : {};
        setItems(data.items || []);
        setTotal(data.total || 0);
        setKpi(data.kpi || null);
        if (data.threshold != null) setThreshold(data.threshold);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, onlyMismatch, page, perPage, api]);

  const noData = t('orderMatching.noData');
  const NoData = () => <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>;

  const kpiChips = kpi ? [
    { id: 'total',    label: t('orderMatching.closed.kpi.total'),    value: kpi.total,    color: 'var(--text)',    active: !onlyMismatch, onClick: () => { setOnlyMismatch(false); setPage(0); } },
    { id: 'mismatch', label: t('orderMatching.closed.kpi.mismatch', { pct: Math.round(threshold * 100) }), value: kpi.mismatch, color: '#ef4444', active: onlyMismatch, onClick: () => { setOnlyMismatch(!onlyMismatch); setPage(0); } },
    { id: 'overrun',  label: t('orderMatching.closed.kpi.overrun'),  value: kpi.overrun,  color: '#f97316', active: false, onClick: () => {} },
    { id: 'saved',    label: t('orderMatching.closed.kpi.saved'),    value: kpi.saved,    color: '#22c55e', active: false, onClick: () => {} },
    { id: 'noNorm',   label: t('orderMatching.closed.kpi.noNorm'),   value: kpi.noNorm,   color: 'var(--text-muted)', active: false, onClick: () => {} },
  ] : [];

  function resetFilters() { setQ(''); setOnlyMismatch(false); setPage(0); }

  return (
    <div className="space-y-2">
      {kpi && (
        <div className="flex flex-wrap gap-1.5">
          {kpiChips.map((c) => {
            const clickable = c.id === 'total' || c.id === 'mismatch';
            return (
              <button key={c.id} onClick={c.onClick} disabled={!clickable}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-all backdrop-blur-md"
                style={{
                  background: c.active ? 'var(--accent)' : 'var(--bg-glass)',
                  color: c.active ? '#fff' : 'var(--text-muted)',
                  border: '1px solid ' + (c.active ? 'var(--accent)' : 'var(--border-glass)'),
                  boxShadow: c.active ? '0 4px 12px rgba(124,58,237,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: clickable ? 1 : 0.85,
                }}>
                <span>{c.label}</span>
                <span className="font-semibold" style={{ color: c.active ? '#fff' : c.color }}>{c.value}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl backdrop-blur-md"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={t('orderMatching.closed.searchPlaceholder')}
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>

        <ChipToggle active={onlyMismatch}
          onClick={() => { setOnlyMismatch(!onlyMismatch); setPage(0); }}
          label={t('orderMatching.closed.onlyMismatch', { pct: Math.round(threshold * 100) })} />

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
                <th className="text-left px-3 py-2">{t('orderMatching.closed.col.orderNumber')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.closed.col.closedAt')}</th>
                <th className="text-right px-3 py-2" style={{ background: CLOSED_COL_BG.norm,    color: CLOSED_COL_HEADER.norm,    fontWeight: 600 }}>{t('orderMatching.closed.col.normHours')}</th>
                <th className="text-right px-3 py-2" style={{ background: CLOSED_COL_BG.dPlan,   color: CLOSED_COL_HEADER.dPlan,   fontWeight: 600 }}>{t('orderMatching.closed.col.dPlan')}</th>
                <th className="text-right px-3 py-2" style={{ background: CLOSED_COL_BG.dUchn,   color: CLOSED_COL_HEADER.dUchn,   fontWeight: 600 }}>{t('orderMatching.closed.col.dUchn')}</th>
                <th className="text-right px-3 py-2" style={{ background: CLOSED_COL_BG.dFact,   color: CLOSED_COL_HEADER.dFact,   fontWeight: 600 }}>{t('orderMatching.closed.col.dFact')}</th>
                <th className="text-right px-3 py-2" style={{ background: CLOSED_COL_BG.dClosed, color: CLOSED_COL_HEADER.dClosed, fontWeight: 600 }}>{t('orderMatching.closed.col.dClosed')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const mismatch = it.norm && it.norm.mismatch;
                const ratio = it.norm ? it.norm.ratio : null;
                const overrun = ratio != null && ratio > 0;
                return (
                  <tr key={it.id} style={{
                    borderTop: '1px solid var(--border)',
                    background: mismatch ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                    boxShadow: mismatch ? 'inset 3px 0 0 #ef4444' : 'none',
                  }}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap align-top">
                      {it.orderNumber ? (
                        <button onClick={() => navigateTo && navigateTo('zn_plan', it.orderNumber)}
                          className="hover:underline transition-colors"
                          title={t('orderMatching.closed.gotoZnPlan')}
                          style={{ color: 'var(--accent)', cursor: 'pointer', background: 'transparent', border: 0, padding: 0, font: 'inherit' }}>
                          {it.orderNumber}
                        </button>
                      ) : <NoData />}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap align-top text-xs">
                      {(() => {
                        const formatted = fmtDt(it.closedAt);
                        if (!formatted) return <NoData />;
                        // Аномалия: «дата закрытия» позже фактического получения письма из 1С
                        // (или вообще в будущем) — оператор 1С проставил плановое/будущее время.
                        const closedMs = new Date(it.closedAt).getTime();
                        const receivedMs = it.receivedAt ? new Date(it.receivedAt).getTime() : null;
                        const isFuture = Number.isFinite(closedMs) && closedMs > Date.now();
                        const isAfterReceived = Number.isFinite(closedMs) && Number.isFinite(receivedMs) && closedMs > receivedMs;
                        if (isFuture || isAfterReceived) {
                          return (
                            <span className="inline-flex items-center gap-1"
                              title={t('data1c.raw.col.closedFutureHint')}
                              style={{ color: '#f59e0b', fontWeight: 600 }}>
                              <AlertTriangle className="w-3 h-3" />
                              {formatted}
                            </span>
                          );
                        }
                        return formatted;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top" style={{ background: CLOSED_COL_BG.norm }}>
                      {fmtHoursNumber(it.normHours) || <NoData />}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top" style={{ background: CLOSED_COL_BG.dPlan }}>
                      {fmtHoursSec(it.durations.tPlan) || <NoData />}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top" style={{ background: CLOSED_COL_BG.dUchn }}>
                      {fmtHoursSec(it.durations.tUchn) || <NoData />}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top" style={{ background: CLOSED_COL_BG.dFact }}>
                      <span style={{ color: mismatch ? '#ef4444' : 'var(--text)', fontWeight: mismatch ? 700 : 400 }}>
                        {fmtHoursSec(it.durations.tFact) || noData}
                      </span>
                      {mismatch && ratio != null && (
                        <div className="text-[9px] mt-0.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded"
                          style={{ background: overrun ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)', color: overrun ? '#ef4444' : '#22c55e' }}>
                          {overrun ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {ratio > 0 ? '+' : ''}{Math.round(ratio * 100)}%
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top" style={{ background: CLOSED_COL_BG.dClosed }}>
                      {fmtHoursSec(it.durations.tClosed) || <NoData />}
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="text-center px-4 py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('orderMatching.empty')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          <Pagination
            page={page + 1}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            totalItems={total}
            perPage={perPage}
            perPageOptions={[25, 50, 100]}
            onPageChange={(p) => setPage(p - 1)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(0); }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- TAB: Закр. ЗН ↔ CV (история постов) ----------
//
// База — «Закрытые ЗН» (deduped performed). Backend для каждой строки ищет
// CV-эпизоды занятости постов в окне ±12ч с матчем plate (каскад exact/core/
// lev1/lev2/last4) и считает probability. UI рендерит:
//   - сводку: посты + Σ времени + лучшая вероятность + badge типа матча
//   - детали (по клику): per-эпизод (пост, окно, plate-варианты, вероятность)
// Источник: GET /api/oneC/matching/closed-cv.

const CV_BADGES = {
  matched:  { color: '#22c55e', icon: CheckCircle2,   key: 'orderMatching.closedCv.cls.matched' },
  weak:     { color: '#eab308', icon: AlertTriangle,  key: 'orderMatching.closedCv.cls.weak' },
  no_match: { color: '#ef4444', icon: XCircle,        key: 'orderMatching.closedCv.cls.noMatch' },
};
const MATCH_TYPE_COLOR = {
  exact: '#22c55e', core: '#84cc16', lev1: '#eab308', lev2: '#f97316', last4: '#a855f7', none: 'var(--text-muted)',
};

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return `${Math.round(v * 100)}%`;
}

function ProbabilityChip({ probability, matchType, t }) {
  const pct = fmtPct(probability);
  if (pct == null) return <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t('orderMatching.noData')}</span>;
  // Цвет фона по probability: ≥0.7 зелёный, ≥0.5 жёлтый, ≥0.3 оранжевый, иначе красный.
  let bg, fg;
  if (probability >= 0.7)      { bg = 'rgba(34,197,94,0.18)';  fg = '#22c55e'; }
  else if (probability >= 0.5) { bg = 'rgba(234,179,8,0.18)';  fg = '#eab308'; }
  else if (probability >= 0.3) { bg = 'rgba(249,115,22,0.18)'; fg = '#f97316'; }
  else                         { bg = 'rgba(239,68,68,0.18)';  fg = '#ef4444'; }
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold whitespace-nowrap"
        style={{ background: bg, color: fg }}>
        {pct}
      </span>
      {matchType && matchType !== 'none' && (
        <span className="text-[9px] uppercase font-mono"
          style={{ color: MATCH_TYPE_COLOR[matchType] || 'var(--text-muted)' }}>
          {t(`orderMatching.closedCv.matchType.${matchType}`)}
        </span>
      )}
    </div>
  );
}

function PostBadge({ ep, t }) {
  const label = ep.postNumber != null
    ? t('orderMatching.closedCv.postLabel', { n: ep.postNumber })
    : (ep.zoneName || t('orderMatching.noData'));
  const dur = fmtDurationSec(ep.durationSec) || '—';
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{
        background: 'var(--bg)',
        color: 'var(--accent)',
        border: '1px solid var(--border)',
        display: 'inline-block',
        maxWidth: '100%',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        lineHeight: 1.3,
      }}
      title={ep.zoneName || ''}>
      {label}
      <span style={{ color: 'var(--text-muted)' }}> · </span>
      <span style={{ color: 'var(--text)' }}>{dur}</span>
    </span>
  );
}

// Унифицированная 3-строчная ячейка авто: brand+model / plate (цветом) / VIN.
function VehicleCell({ item, t }) {
  const noData = t('orderMatching.noData');
  const brandModel = [item.brand, item.model].filter(Boolean).join(' ');
  const plate = item.plate1c;
  const vin = item.vin;
  if (!brandModel && !plate && !vin) {
    if (item.vehicleText) {
      return <div className="text-xs" style={{ color: 'var(--text)' }}>{item.vehicleText}</div>;
    }
    return <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs leading-tight">
      <div style={{ color: 'var(--text)', fontWeight: 500 }}>
        {brandModel || <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>}
      </div>
      <div className="font-mono">
        {plate
          ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{plate}</span>
          : <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>}
      </div>
      <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {vin || ''}
      </div>
    </div>
  );
}

// Агрегирует уникальные plate-варианты по всем эпизодам строки → [{plate, count, posts:[postNumber...]}]
function aggregateCvPlates(episodes) {
  const total = new Map();
  for (const ep of episodes || []) {
    const variants = ep.plateVariants || {};
    for (const [plate, count] of Object.entries(variants)) {
      const cur = total.get(plate) || { plate, count: 0, posts: new Set() };
      cur.count += Number(count) || 0;
      if (ep.postNumber != null) cur.posts.add(ep.postNumber);
      total.set(plate, cur);
    }
  }
  return Array.from(total.values())
    .map((x) => ({ ...x, posts: Array.from(x.posts).sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count);
}

// Сравнивает CV-плейт с эталонным 1С — возвращает true, если строго совпадает после нормализации.
function plateLooksLikeRef(cvPlate, refPlate) {
  if (!cvPlate || !refPlate) return false;
  const norm = (s) => String(s).toUpperCase().replace(/[\s\-_.]+/g, '');
  return norm(cvPlate) === norm(refPlate);
}

function CvPlatesCell({ item, t, onOpen }) {
  const noData = t('orderMatching.noData');
  const plates = aggregateCvPlates(item.episodes);
  if (plates.length === 0) return <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>;
  const top = plates.slice(0, 2);
  const more = plates.length - top.length;
  return (
    <div className="flex flex-col items-start gap-0.5">
      {top.map((p) => {
        const matchRef = plateLooksLikeRef(p.plate, item.plate1c);
        return (
          <span key={p.plate}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap"
            style={{
              background: matchRef ? 'rgba(34,197,94,0.14)' : 'var(--bg)',
              color: matchRef ? '#22c55e' : 'var(--text)',
              border: '1px solid ' + (matchRef ? 'rgba(34,197,94,0.4)' : 'var(--border)'),
            }}>
            <span style={{ fontWeight: 600 }}>{p.plate}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>×{p.count}</span>
          </span>
        );
      })}
      {more > 0 && (
        <button onClick={onOpen}
          className="text-[10px] underline"
          style={{ color: 'var(--accent)', cursor: 'pointer' }}>
          {t('orderMatching.closedCv.morePlates', { count: more })}
        </button>
      )}
    </div>
  );
}

function CvPlatesModal({ item, t, onClose }) {
  if (!item) return null;
  const plates = aggregateCvPlates(item.episodes);
  const totalReads = plates.reduce((s, p) => s + p.count, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {t('orderMatching.closedCv.platesModal.title')}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('orderMatching.closedCv.platesModal.subtitle', {
                order: item.orderNumber || '—',
                plate: item.plate1c || t('orderMatching.noData'),
                total: totalReads,
                variants: plates.length,
              })}
            </div>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-xs rounded"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
              <tr>
                <th className="text-left px-3 py-2">{t('orderMatching.closedCv.platesModal.col.plate')}</th>
                <th className="text-right px-3 py-2">{t('orderMatching.closedCv.platesModal.col.count')}</th>
                <th className="text-left px-3 py-2">{t('orderMatching.closedCv.platesModal.col.posts')}</th>
                <th className="text-right px-3 py-2">{t('orderMatching.closedCv.platesModal.col.share')}</th>
              </tr>
            </thead>
            <tbody>
              {plates.map((p) => {
                const matchRef = plateLooksLikeRef(p.plate, item.plate1c);
                const share = totalReads > 0 ? p.count / totalReads : 0;
                return (
                  <tr key={p.plate} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-1.5 font-mono">
                      <span style={{
                        color: matchRef ? '#22c55e' : 'var(--text)',
                        fontWeight: matchRef ? 700 : 500,
                      }}>{p.plate}</span>
                      {matchRef && (
                        <span className="ml-2 text-[9px] uppercase" style={{ color: '#22c55e' }}>
                          {t('orderMatching.closedCv.platesModal.refMatch')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text)' }}>{p.count}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {p.posts.length === 0
                          ? <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t('orderMatching.noData')}</span>
                          : p.posts.map((n) => (
                              <span key={n} className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                                style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                                {t('orderMatching.closedCv.postLabel', { n })}
                              </span>
                            ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                      {Math.round(share * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabClosedZnCv({ t }) {
  const { api } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState(null);
  const [windowHours, setWindowHours] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [platesModalItem, setPlatesModalItem] = useState(null);

  const [q, setQ] = useState('');
  const [classification, setClassification] = useState([]); // ['matched','weak','no_match']
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(50);
  const [sortBy, setSortBy] = useState('workStartedAt');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('take', String(perPage));
    params.set('skip', String(page * perPage));
    if (q.trim()) params.set('q', q.trim());
    if (classification.length) params.set('classification', classification.join(','));
    if (sortBy) params.set('sortBy', sortBy);
    if (sortDir) params.set('sortDir', sortDir);

    api.get(`/api/oneC/matching/closed-cv?${params.toString()}`)
      .then((res) => {
        const data = res && res.data ? res.data : {};
        setItems(data.items || []);
        setTotal(data.total || 0);
        setKpi(data.kpi || null);
        if (data.windowHours) setWindowHours(data.windowHours);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, classification.join(','), page, perPage, sortBy, sortDir, api]);

  function onSort(key) {
    if (sortBy === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(key); setSortDir(key === 'orderNumber' ? 'asc' : 'desc'); }
    setPage(0);
  }
  function toggleExpanded(id) {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleCls(value) {
    setClassification((cur) => cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]);
    setPage(0);
  }
  function resetFilters() { setQ(''); setClassification([]); setPage(0); }

  const noData = t('orderMatching.noData');
  const NoData = () => <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{noData}</span>;

  const kpiChips = kpi ? [
    { id: 'all',      label: t('orderMatching.closedCv.kpi.total'),    value: kpi.total,    color: 'var(--text)', active: classification.length === 0, onClick: () => { setClassification([]); setPage(0); } },
    { id: 'matched',  label: t('orderMatching.closedCv.kpi.matched'),  value: kpi.matched,  color: '#22c55e',     active: classification.includes('matched'),  onClick: () => toggleCls('matched') },
    { id: 'weak',     label: t('orderMatching.closedCv.kpi.weak'),     value: kpi.weak,     color: '#eab308',     active: classification.includes('weak'),     onClick: () => toggleCls('weak') },
    { id: 'noMatch',  label: t('orderMatching.closedCv.kpi.noMatch'),  value: kpi.noMatch,  color: '#ef4444',     active: classification.includes('no_match'), onClick: () => toggleCls('no_match') },
    { id: 'noPlate',  label: t('orderMatching.closedCv.kpi.noPlate'),  value: kpi.total - kpi.withPlate1c, color: 'var(--text-muted)', active: false, onClick: () => {} },
  ] : [];

  return (
    <div className="space-y-2">
      {kpi && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {kpiChips.map((c) => {
            const clickable = c.id !== 'noPlate';
            return (
              <button key={c.id} onClick={c.onClick} disabled={!clickable}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-all backdrop-blur-md"
                style={{
                  background: c.active ? 'var(--accent)' : 'var(--bg-glass)',
                  color: c.active ? '#fff' : 'var(--text-muted)',
                  border: '1px solid ' + (c.active ? 'var(--accent)' : 'var(--border-glass)'),
                  boxShadow: c.active ? '0 4px 12px rgba(124,58,237,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: clickable ? 1 : 0.85,
                }}>
                <span>{c.label}</span>
                <span className="font-semibold" style={{ color: c.active ? '#fff' : c.color }}>{c.value}</span>
              </button>
            );
          })}
          <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>
            {t('orderMatching.closedCv.windowHint', { h: windowHours })}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap p-2 rounded-xl backdrop-blur-md"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder={t('orderMatching.closedCv.searchPlaceholder')}
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </div>
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
                <SortableTh sortKey="orderNumber"        sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.orderNumber')}</SortableTh>
                <th className="text-left px-3 py-2">{t('orderMatching.closedCv.col.vehicle')}</th>
                <SortableTh sortKey="workStartedAt"      sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.workStart')}</SortableTh>
                <SortableTh sortKey="workFinishedAt"     sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.workEnd')}</SortableTh>
                <SortableTh sortKey="normHours"          sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.normHours')}</SortableTh>
                <SortableTh sortKey="tFact"              sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.tFact')}</SortableTh>
                <th className="text-left px-3 py-2" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>{t('orderMatching.closedCv.col.posts')}</th>
                <th className="text-left px-3 py-2" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>{t('orderMatching.closedCv.col.cvPlates')}</th>
                <SortableTh sortKey="totalCvDurationSec" sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.totalCv')}</SortableTh>
                <SortableTh sortKey="probability"        sortBy={sortBy} sortDir={sortDir} onSort={onSort}>{t('orderMatching.closedCv.col.probability')}</SortableTh>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isExpanded = expanded.has(it.id);
                const canExpand = it.episodes && it.episodes.length > 0;
                const cls = CV_BADGES[it.classification];
                const ClsIcon = cls ? cls.icon : null;
                return (
                  <FragmentRow key={it.id}>
                    <tr style={{ borderTop: '1px solid var(--border)', background: isExpanded ? 'var(--bg)' : 'transparent' }}>
                      <td className="px-2 py-2 text-center align-top">
                        {canExpand ? (
                          <button onClick={() => toggleExpanded(it.id)} style={{ color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap align-top text-xs">
                        {it.orderNumber || <NoData />}
                        {cls && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: 'var(--card-bg)', color: cls.color, border: `1px solid ${cls.color}40` }}>
                            <ClsIcon className="w-3 h-3" />
                            {t(cls.key)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top" style={{ minWidth: '170px', maxWidth: '230px' }}>
                        <VehicleCell item={it} t={t} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-top text-xs">{fmtDt(it.workStartedAt) || <NoData />}</td>
                      <td className="px-3 py-2 whitespace-nowrap align-top text-xs">{fmtDt(it.workFinishedAt) || <NoData />}</td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top text-xs">
                        {fmtHoursNumber(it.normHours) || <NoData />}
                      </td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top text-xs">
                        {fmtDurationSec(it.tFact) || <NoData />}
                      </td>
                      <td className="px-3 py-2 align-top" style={{ width: '180px', minWidth: '180px', maxWidth: '180px', overflow: 'hidden' }}>
                        {canExpand ? (
                          <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
                            {it.episodes.map((ep, i) => <PostBadge key={i} ep={ep} t={t} />)}
                          </div>
                        ) : <NoData />}
                      </td>
                      <td className="px-3 py-2 align-top" style={{ width: '180px', minWidth: '180px', maxWidth: '180px', overflow: 'hidden' }}>
                        <CvPlatesCell item={it} t={t} onOpen={() => setPlatesModalItem(it)} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap align-top text-xs">
                        {it.summary && it.summary.totalCvDurationSec > 0 ? fmtDurationSec(it.summary.totalCvDurationSec) : <NoData />}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <ProbabilityChip probability={it.summary && it.summary.bestProbability} matchType={it.summary && it.summary.bestMatchType} t={t} />
                      </td>
                    </tr>
                    {isExpanded && canExpand && (
                      <tr style={{ background: 'var(--bg)', borderTop: '1px dashed var(--border)' }}>
                        <td colSpan={11} className="px-6 py-3">
                          <CvEpisodesDetail item={it} t={t} />
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
              {!loading && items.length === 0 && (
                <tr><td colSpan={11} className="text-center px-4 py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('orderMatching.empty')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-1.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          <Pagination
            page={page + 1}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            totalItems={total}
            perPage={perPage}
            perPageOptions={[25, 50, 100]}
            onPageChange={(p) => setPage(p - 1)}
            onPerPageChange={(pp) => { setPerPage(pp); setPage(0); }}
          />
        </div>
      </div>

      {platesModalItem && (
        <CvPlatesModal item={platesModalItem} t={t} onClose={() => setPlatesModalItem(null)} />
      )}
    </div>
  );
}

// React.Fragment shortcut для повторного использования key=
function FragmentRow({ children }) { return <>{children}</>; }

// Развёрнутая детализация: список эпизодов с per-episode probability + plate-варианты.
function CvEpisodesDetail({ item, t }) {
  const noData = t('orderMatching.noData');
  return (
    <div className="space-y-2">
      <div className="text-xs flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
        <span>{t('orderMatching.closedCv.detail.window', {
          from: fmtDt(item.window && item.window.from) || noData,
          to: fmtDt(item.window && item.window.to) || noData,
        })}</span>
        {item.summary && item.summary.cvFirstSeen && (
          <span>{t('orderMatching.closedCv.detail.cvFirstLast', {
            first: fmtDt(item.summary.cvFirstSeen) || noData,
            last:  fmtDt(item.summary.cvLastSeen) || noData,
          })}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead style={{ color: 'var(--text-muted)' }}>
            <tr>
              <th className="text-left px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.post')}</th>
              <th className="text-left px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.start')}</th>
              <th className="text-left px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.end')}</th>
              <th className="text-right px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.duration')}</th>
              <th className="text-left px-2 py-1">{t('orderMatching.closedCv.detail.col.consensus')}</th>
              <th className="text-left px-2 py-1">{t('orderMatching.closedCv.detail.col.variants')}</th>
              <th className="text-right px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.formula')}</th>
              <th className="text-right px-2 py-1 whitespace-nowrap">{t('orderMatching.closedCv.detail.col.probability')}</th>
            </tr>
          </thead>
          <tbody>
            {(item.episodes || []).map((ep, idx) => {
              // Список вариантов (отсортирован по убыванию count), для UI компактно.
              const variantPairs = Object.entries(ep.plateVariants || {})
                .sort((a, b) => b[1] - a[1]);
              const consensusRatioPct = ep.plateConsensusRatio != null ? Math.round(ep.plateConsensusRatio * 100) : null;
              const overlapPct = ep.timeOverlap != null ? Math.round(ep.timeOverlap * 100) : null;
              const plateScorePct = ep.plateScore != null ? Math.round(ep.plateScore * 100) : null;
              return (
                <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-2 py-1 whitespace-nowrap font-mono">
                    {ep.postNumber != null
                      ? t('orderMatching.closedCv.postLabel', { n: ep.postNumber })
                      : (ep.zoneName || '—')}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDt(ep.startTime) || noData}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDt(ep.endTime) || noData}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right font-mono">{fmtDurationSec(ep.durationSec) || noData}</td>
                  <td className="px-2 py-1 font-mono">
                    <span>{ep.plateConsensus || noData}</span>
                    {consensusRatioPct != null && (
                      <span className="ml-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        ({ep.plateConsensusCount}× / {consensusRatioPct}%)
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-wrap gap-1" style={{ maxWidth: '320px' }}>
                      {variantPairs.slice(0, 8).map(([variant, cnt]) => (
                        <span key={variant} className="px-1 py-0.5 rounded text-[10px] font-mono whitespace-nowrap"
                          style={{
                            background: variant === ep.bestVariant ? 'rgba(34,197,94,0.18)' : 'var(--card-bg)',
                            color: variant === ep.bestVariant ? '#22c55e' : 'var(--text-muted)',
                            border: variant === ep.bestVariant ? '1px solid #22c55e60' : '1px solid var(--border)',
                          }}
                          title={variant === ep.bestVariant ? t('orderMatching.closedCv.detail.bestVariantHint') : ''}>
                          {variant} <span style={{ opacity: 0.6 }}>×{cnt}</span>
                        </span>
                      ))}
                      {variantPairs.length > 8 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {t('orderMatching.closedCv.detail.moreVariants', { count: variantPairs.length - 8 })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {plateScorePct != null && consensusRatioPct != null && overlapPct != null
                      ? `${plateScorePct}% × ${consensusRatioPct}% × ${overlapPct}%`
                      : noData}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <ProbabilityChip probability={ep.probability} matchType={ep.matchType} t={t} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- TAB: Выработка ----------
// 3 ролевых среза (исполнитель / мастер / диспетчер).
// Данные: GET /api/payroll?role=...&from=&to= → { items, totalNorm, totalCvHours }
//   - нормочасы и заказы — последняя версия OneCWorkPerformed на orderNumber,
//   - CV-часы по ЗН — через OneCCvMatch → PostStay.activeTime,
//   - в каждом срезе CV-время засчитывается ПОЛНОСТЬЮ человеку соответствующей роли.

const PAYROLL_ROLES = [
  { id: 'executor',   icon: Wrench,    labelKey: 'payroll.role.executor' },
  { id: 'master',     icon: UserCog,   labelKey: 'payroll.role.master' },
  { id: 'dispatcher', icon: Briefcase, labelKey: 'payroll.role.dispatcher' },
];

function payrollTdStyle(idx) {
  return { background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' };
}

function TabPayroll({ t }) {
  const { api } = useAuth();
  const [role, setRole] = useState('executor');
  const [data, setData] = useState({ items: [], totalNorm: 0, totalCvHours: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const m = new Date(now); m.setDate(m.getDate() - 29); m.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    return { preset: 'month', from: m.toISOString(), to: e.toISOString() };
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('role', role);
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
      const r = await api.get(`/api/payroll?${params.toString()}`);
      setData(r.data || { items: [], totalNorm: 0, totalCvHours: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [role, period.from, period.to]);
  useEffect(() => { setPage(1); }, [role, period.preset, period.from, period.to]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort(data.items || [], 'normHours', 'desc');
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pageItems = sorted.slice((page - 1) * perPage, page * perPage);

  const items = data.items || [];
  const totalOrders = items.reduce((s, r) => s + (r.orders || 0), 0);
  const avgNorm = items.length ? Math.round((data.totalNorm / items.length) * 10) / 10 : 0;

  return (
    <div className="space-y-3">
      {/* Sub-tabs ролей */}
      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-glass)' }}>
        {PAYROLL_ROLES.map((r) => {
          const Icon = r.icon;
          const isActive = role === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className="px-3 py-1.5 text-sm flex items-center gap-1.5 transition-all whitespace-nowrap"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <Icon size={14} /> {t(r.labelKey)}
            </button>
          );
        })}
      </div>

      {/* KPI */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label={t('payroll.kpi.persons')}   value={items.length}      icon={Users}      tone="default" />
        <KpiCard label={t('payroll.kpi.normHours')} value={data.totalNorm}    icon={Hourglass}  tone="accent"  hint={t('payroll.hoursUnit')} />
        <KpiCard label={t('payroll.kpi.orders')}    value={totalOrders}       icon={ListChecks} tone="info" />
        <KpiCard label={t('payroll.kpi.cvHours')}   value={data.totalCvHours || 0} icon={Activity} tone="warning" hint={t('payroll.hoursUnit')} />
        <KpiCard label={t('payroll.kpi.avg')}       value={avgNorm}           icon={BarChart3}  tone="success" hint={t('payroll.hoursUnit')} />
      </div>

      {/* Период */}
      <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {t('payroll.filterByClosed')}
        </span>
        <PeriodPresets value={period} onChange={setPeriod} allowAll={false} />
        <button onClick={load} disabled={loading}
          className="ml-auto px-2.5 py-1 rounded-md text-xs flex items-center gap-1"
          style={{ background: 'var(--accent)', color: 'white' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {t('payroll.refresh')}
        </button>
      </div>

      {/* Таблица */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(0,0,0,0.12)', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <SortableTh sortKey="person"    sortBy={sortKey} sortDir={sortDir} onSort={toggle}>{t(`payroll.col.${role}`)}</SortableTh>
                <SortableTh sortKey="normHours" sortBy={sortKey} sortDir={sortDir} onSort={toggle} align="right">{t('payroll.col.normHours')}</SortableTh>
                <SortableTh sortKey="orders"    sortBy={sortKey} sortDir={sortDir} onSort={toggle} align="right">{t('payroll.col.orders')}</SortableTh>
                <SortableTh sortKey="cvHours"   sortBy={sortKey} sortDir={sortDir} onSort={toggle} align="right">{t('payroll.col.cvHours')}</SortableTh>
                <th className="text-left px-3 py-2">{t('payroll.col.repairKinds')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('payroll.loading')}</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)' }}>{t('payroll.noData')}</td></tr>
              ) : pageItems.map((r, idx) => {
                const globalRank = (page - 1) * perPage + idx;
                const medal = sortKey === 'normHours' && sortDir === 'desc' ? globalRank : -1;
                const stripe = medal === 0 ? '#fbbf24' : medal === 1 ? '#cbd5e1' : medal === 2 ? '#d97706' : 'transparent';
                return (
                  <tr key={r.person} className="transition-colors hover:bg-[var(--bg-glass-hover)]"
                      style={{ ...payrollTdStyle(idx), borderTop: '1px solid var(--border-glass)', boxShadow: stripe !== 'transparent' ? `inset 4px 0 0 ${stripe}` : undefined }}>
                    <td className="px-3 py-2 font-medium">{r.person}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.normHours}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.orders}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.cvHours}</td>
                    <td className="px-3 py-2"><RepairKindChips kinds={r.repairKinds} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 && (
          <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
            <Pagination
              page={page} totalPages={totalPages} totalItems={sorted.length}
              perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}
            />
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

// Кликабельный заголовок столбца с тривиальной индикацией направления.
// Активная колонка: иконка ↑/↓; неактивная: «двойная» иконка ⇅ (приглушённо).
function SortableTh({ sortKey, sortBy, sortDir, onSort, children, align = 'left' }) {
  const isActive = sortBy === sortKey;
  const Icon = isActive ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`text-${align} px-3 py-2 select-none`}>
      <button onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:opacity-100 transition-opacity"
        style={{
          background: 'transparent', border: 0, padding: 0, font: 'inherit',
          color: isActive ? 'var(--accent)' : 'inherit',
          cursor: 'pointer',
          opacity: isActive ? 1 : 0.85,
        }}>
        <span>{children}</span>
        <Icon className="w-3 h-3" style={{ opacity: isActive ? 1 : 0.45 }} />
      </button>
    </th>
  );
}

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

function RowAndDetail({ item, isExpanded, onToggle, t, highlight, rowRef }) {
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
      <tr ref={rowRef} style={{
          borderTop: '1px solid var(--border)',
          background: highlight ? 'rgba(124, 58, 237, 0.18)' : (isExpanded ? 'var(--bg)' : 'transparent'),
          boxShadow: highlight ? 'inset 3px 0 0 var(--accent)' : 'none',
          transition: 'background 0.35s ease',
        }}>
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
