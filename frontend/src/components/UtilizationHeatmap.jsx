import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Цвет клетки по проценту загрузки.
function colorForPct(pct) {
  if (pct == null) return 'transparent';
  if (pct < 50)  return 'rgba(148,163,184,0.55)'; // slate-400
  if (pct < 70)  return 'rgba(245,158,11,0.85)';  // amber-500
  if (pct < 90)  return 'rgba(34,197,94,0.85)';   // green-500
  if (pct <= 100) return 'rgba(16,185,129,0.95)'; // emerald-500
  return 'rgba(239,68,68,0.95)';                  // red-500 (overload)
}

const MONTHS_RU_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MONTHS_EN_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_RU_LONG  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_EN_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseYMD(dateStr) {
  // "2026-05-15" → {y,m,d} (м = 1..12)
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
  return { y, m, d };
}

function isoDow(dateStr) {
  // 1..7 (Mon..Sun) — на UTC-полночь, для grid позиционирования
  const d = new Date(`${dateStr}T00:00:00Z`);
  const js = d.getUTCDay(); // 0=Sun..6=Sat
  return js === 0 ? 7 : js;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Хитмап-календарь.
 *
 * Props:
 *   byDay:        [{ date, shiftFund, busy, loadPct }, ...]  — агрегат по всем сущностям за день
 *   onSelectDate: (date) => void                              — drill-down
 *   currency:     '₽' | '$' | ...
 *   hourlyRate:   number | null                                — для финтултипа
 */
export default function UtilizationHeatmap({ byDay = [], onSelectDate, currency = '₽', hourlyRate = null }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const monthsShort = isRu ? MONTHS_RU_SHORT : MONTHS_EN_SHORT;
  const monthsLong  = isRu ? MONTHS_RU_LONG  : MONTHS_EN_LONG;

  const weeks = useMemo(() => buildWeekGrid(byDay), [byDay]);

  // Заголовок диапазона: «16 апр – 16 мая 2026» (помогает понять, что за даты)
  const rangeLabel = useMemo(() => {
    if (!byDay.length) return '';
    const sorted = [...byDay].sort((a, b) => a.date.localeCompare(b.date));
    const a = parseYMD(sorted[0].date);
    const b = parseYMD(sorted[sorted.length - 1].date);
    const fromStr = `${a.d} ${monthsLong[a.m - 1]}${a.y !== b.y ? ' ' + a.y : ''}`;
    const toStr   = `${b.d} ${monthsLong[b.m - 1]} ${b.y}`;
    return `${fromStr} — ${toStr}`;
  }, [byDay, monthsLong]);

  if (!byDay.length) return null;

  const dayLabels = isRu ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div className="glass-static rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t('utilization.heatmap.title')}
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {rangeLabel}
        </div>
      </div>

      {/* Заголовок дней недели */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {dayLabels.map(l => (
          <div key={l} className="text-[10px] uppercase font-semibold text-center"
            style={{ color: 'var(--text-muted)' }}>{l}</div>
        ))}
      </div>

      {/* Клетки по неделям */}
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, ci) => {
              if (!cell) return <div key={ci} />;
              const { date, shiftFund, busy, loadPct, empty } = cell;
              const ymd = parseYMD(date);
              const monthLbl = monthsShort[ymd.m - 1];

              if (empty) {
                // День в диапазоне, но без данных — показываем дату приглушённой,
                // чтобы пользователь видел все дни и не путался в датах.
                return (
                  <div
                    key={ci}
                    className="rounded-lg p-1.5"
                    style={{
                      background: 'transparent',
                      border: '1px dashed var(--border-glass)',
                      minHeight: 60,
                      opacity: 0.55,
                    }}
                    title={`${date} · ${t('utilization.heatmap.noData') || (isRu ? 'нет данных' : 'no data')}`}
                  >
                    <div className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      <span>{ymd.d}</span>
                      <span className="ml-0.5 font-normal lowercase">{monthLbl}</span>
                    </div>
                  </div>
                );
              }

              const earned = (hourlyRate != null && busy != null) ? Math.round(hourlyRate * busy) : null;
              const idle = (shiftFund != null && busy != null) ? Math.max(0, shiftFund - busy) : null;
              const lost = (hourlyRate != null && idle != null) ? Math.round(hourlyRate * idle) : null;
              const tip = [
                `${ymd.d} ${monthsLong[ymd.m - 1]} ${ymd.y}`,
                shiftFund != null ? `${isRu ? 'Раб. фонд' : 'Fund'}: ${shiftFund} ${isRu ? 'ч' : 'h'}` : null,
                busy != null ? `${isRu ? 'Занят.' : 'Busy'}: ${busy} ${isRu ? 'ч' : 'h'}` : null,
                loadPct != null ? `${isRu ? 'Загрузка' : 'Load'}: ${loadPct}%` : null,
                earned != null ? `${isRu ? 'Заработ.' : 'Earned'}: ${earned} ${currency}` : null,
                lost != null ? `${isRu ? 'Потери' : 'Lost'}: ${lost} ${currency}` : null,
              ].filter(Boolean).join(' · ');

              // Подсветка 1-го числа месяца — лёгкая рамка-акцент, удобный визуальный «разделитель»
              const isFirstOfMonth = ymd.d === 1;

              return (
                <button
                  key={ci}
                  type="button"
                  onClick={() => onSelectDate?.(date)}
                  className="text-left rounded-lg p-1.5 hover:opacity-90 transition-all"
                  title={tip}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: isFirstOfMonth
                      ? '1px solid var(--accent-primary, rgba(99,102,241,0.85))'
                      : '1px solid var(--border-glass)',
                    minHeight: 60,
                  }}
                >
                  <div className="text-[10px] font-bold mb-0.5 flex items-baseline gap-0.5" style={{ color: 'var(--text-primary)' }}>
                    <span>{ymd.d}</span>
                    <span className="font-normal lowercase" style={{ color: 'var(--text-muted)' }}>{monthLbl}</span>
                  </div>
                  {/* bar 1: hours */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(99,102,241,0.15)' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: shiftFund > 0 ? `${Math.min(100, (busy / shiftFund) * 100)}%` : '0%',
                          background: 'rgba(99,102,241,0.85)',
                        }} />
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {busy != null ? busy : '—'}
                    </span>
                  </div>
                  {/* bar 2: load % */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(0,0,0,0.15)' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: loadPct != null ? `${Math.min(100, loadPct)}%` : '0%',
                          background: colorForPct(loadPct),
                        }} />
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {loadPct != null ? `${loadPct}%` : '—'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Группирует список дней в матрицу 7-колоночной сетки (понедельник = первый столбец).
// Заполняет пропущенные даты внутри диапазона «пустыми» клетками с empty=true,
// чтобы все дни были видны.
function buildWeekGrid(byDay) {
  if (!byDay.length) return [];
  const sorted = [...byDay].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map(d => [d.date, d]));
  const firstDate = sorted[0].date;
  const lastDate  = sorted[sorted.length - 1].date;

  // Линейный список всех дат в диапазоне
  const dates = [];
  for (let cur = firstDate; cur <= lastDate; cur = addDays(cur, 1)) {
    dates.push(cur);
  }

  const weeks = [];
  let row = new Array(7).fill(null);
  for (const date of dates) {
    const cell = byDate.get(date) || { date, shiftFund: null, busy: null, loadPct: null, empty: true };
    const dow = isoDow(date); // 1..7
    row[dow - 1] = cell;
    if (dow === 7) {
      weeks.push(row);
      row = new Array(7).fill(null);
    }
  }
  if (row.some(Boolean)) weeks.push(row);
  return weeks;
}
