// Страница «Сопоставление ЗН и заявок».
// Источник: GET /api/oneC/matching — дедуплицированные данные из «Заказ-наряды» и «Планы и Заявки».
// Алгоритм матчинга (бэк): repair.basis === plan.documentText.

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Search, Filter, ChevronDown, ChevronRight,
  AlertTriangle, GitBranch,
  CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ---------- helpers ----------

function fmtDt(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSignedSec(sec) {
  if (sec == null) return '—';
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sign = sec > 0 ? '+' : sec < 0 ? '−' : '';
  if (h > 0) return `${sign}${h}ч ${m}м`;
  return `${sign}${m}м`;
}

function fmtDurationSec(sec) {
  if (sec == null) return '—';
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

function vehicleString(item) {
  const parts = [item.brand, item.model].filter(Boolean).join(' ');
  const subParts = [item.plateNumber1 || item.plateNumber2, item.vin].filter(Boolean);
  if (parts) return `${parts}${subParts.length ? ' · ' + subParts.join(' / ') : ''}`;
  if (item.vehicleText) return item.vehicleText;
  return subParts.join(' / ') || '—';
}

// 3-строчная ячейка моментов (план/уточн/факт) с подсветкой
function MomentCell({ planVal, uchnVal, factVal, uchnSev, factSev, t }) {
  const cPlan = SEVERITY_COLORS.gray;
  const cUchn = SEVERITY_COLORS[uchnSev] || SEVERITY_COLORS.gray;
  const cFact = SEVERITY_COLORS[factSev] || SEVERITY_COLORS.gray;
  const Row = ({ label, val, c }) => (
    <div className="flex items-baseline gap-2 px-1 rounded whitespace-nowrap leading-tight"
      style={{ background: c.bg }}>
      <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[11px] font-mono" style={{ color: c.fg }}>{fmtDt(val) || '—'}</span>
    </div>
  );
  return (
    <div className="space-y-0.5">
      <Row label={t('orderMatching.row.plan')}  val={planVal} c={cPlan} />
      <Row label={t('orderMatching.row.uchn')}  val={uchnVal} c={cUchn} />
      <Row label={t('orderMatching.row.fact')}  val={factVal} c={cFact} />
    </div>
  );
}

// Δ ячейка длительности (со знаком и подсветкой)
function DeltaCell({ deltaSec, severity }) {
  const c = SEVERITY_COLORS[severity] || SEVERITY_COLORS.gray;
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}>
      {fmtSignedSec(deltaSec)}
    </span>
  );
}

// ---------- main ----------

export default function OrderMatching() {
  const { t } = useTranslation();
  const { api } = useAuth();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  // фильтры
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-semibold">{t('nav.orderMatching')}</h1>
      </div>

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label={t('orderMatching.kpi.total')}        value={kpi.total} />
          <KpiCard label={t('orderMatching.kpi.matched')}      value={kpi.matched}        color="#22c55e" />
          <KpiCard label={t('orderMatching.kpi.noBasis')}      value={kpi.noBasis}        color="var(--text-muted)" />
          <KpiCard label={t('orderMatching.kpi.basisNotFound')} value={kpi.basisNotFound} color="#ef4444" />
          <KpiCard label={t('orderMatching.kpi.severityOrangeOrRed')} value={kpi.severityOrangeOrRed} color="#f97316" />
        </div>
      )}

      <div className="p-4 rounded-lg space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder={t('orderMatching.searchPlaceholder')}
              className="flex-1 px-3 py-1.5 rounded text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <button onClick={resetFilters} className="px-3 py-1.5 text-sm rounded"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {t('orderMatching.resetFilters')}
          </button>
        </div>

        <div className="flex items-center gap-4 flex-wrap text-sm">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />

          <div className="flex items-center gap-1 flex-wrap">
            <span style={{ color: 'var(--text-muted)' }}>{t('orderMatching.matchStatus')}:</span>
            {['matched','matched_vehicle_mismatch','no_basis','basis_not_found'].map((s) => (
              <ChipToggle key={s} active={matchStatus.includes(s)}
                onClick={() => { toggleMulti(setMatchStatus, s, matchStatus); setPage(0); }}
                label={t(`orderMatching.${MATCH_BADGES[s].key}`)} />
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span style={{ color: 'var(--text-muted)' }}>{t('orderMatching.minSeverity')}:</span>
            {['','yellow','orange','red'].map((s) => (
              <ChipToggle key={s||'all'} active={minSeverity === s}
                onClick={() => { setMinSeverity(s); setPage(0); }}
                label={s ? t(`orderMatching.severity.${s}`) : t('orderMatching.severity.all')} />
            ))}
          </div>

          {stateOptions.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span style={{ color: 'var(--text-muted)' }}>{t('orderMatching.state')}:</span>
              {stateOptions.map((s) => (
                <ChipToggle key={s} active={stateFilter.includes(s)}
                  onClick={() => { toggleMulti(setStateFilter, s, stateFilter); setPage(0); }}
                  label={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-2 flex items-center justify-between text-sm" style={{ borderBottom: '1px solid var(--border)' }}>
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
          <div className="px-4 py-2 flex items-center justify-between text-sm" style={{ borderTop: '1px solid var(--border)' }}>
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

// ---------- subcomponents ----------

function KpiCard({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl font-semibold mt-1" style={{ color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

function ChipToggle({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className="px-2 py-0.5 rounded text-xs"
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
          <div>{vehicleString(item)}</div>
          {item.hasHistory && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px]" style={{ color: '#a855f7' }}>
              <GitBranch className="w-3 h-3" />
              {t('orderMatching.hasHistory', { count: (item.history || []).length })}
            </span>
          )}
        </td>
        <td className="px-3 py-2 font-mono whitespace-nowrap align-top">{item.orderNumber}</td>
        <td className="px-3 py-2 whitespace-nowrap align-top">{item.state || '—'}</td>
        <td className="px-3 py-2 align-top">
          <div className="text-xs max-w-[260px] truncate" title={item.basis || ''}>
            {item.basis || <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
          <DeltaCell deltaSec={dur.deltaPlan} severity={dur.sevPlan} />
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('orderMatching.col.dPlanHint', { fact: fmtDurationSec(dur.tFact), plan: fmtDurationSec(dur.tPlan) })}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <DeltaCell deltaSec={dur.deltaUchn} severity={dur.sevUchn} />
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('orderMatching.col.dUchnHint', { fact: fmtDurationSec(dur.tFact), uchn: fmtDurationSec(dur.tUchn) })}
          </div>
        </td>

        <td className="px-3 py-2 text-xs align-top">{item.master || '—'}</td>
        <td className="px-3 py-2 text-xs align-top">{item.dispatcher || '—'}</td>
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
function fmtCell(val, fmt) {
  if (val == null || val === '') return '—';
  if (fmt === 'dt') return fmtDt(val) || '—';
  return String(val);
}

function HistoryTable({ history, t }) {
  if (!history.length) return null;

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
                    {fmtDt(s.receivedAt) || '—'}
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
                        {fmtCell(v, c.fmt)}
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
