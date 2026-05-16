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

function dayMonthLabel(dateStr) {
  // "2026-05-15" → "15"
  if (!dateStr) return '';
  const [, , d] = dateStr.split('-');
  return String(parseInt(d, 10));
}

function isoDow(dateStr) {
  // 1..7 (Mon..Sun) — на UTC-полночь, для grid позиционирования
  const d = new Date(`${dateStr}T00:00:00Z`);
  const js = d.getUTCDay(); // 0=Sun..6=Sat
  return js === 0 ? 7 : js;
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

  const weeks = useMemo(() => buildWeekGrid(byDay), [byDay]);

  if (!byDay.length) return null;

  const dayLabels = isRu ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div className="glass-static rounded-xl p-3">
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
        {t('utilization.heatmap.title')}
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
              const { date, shiftFund, busy, loadPct } = cell;
              const earned = (hourlyRate != null && busy != null) ? Math.round(hourlyRate * busy) : null;
              const idle = (shiftFund != null && busy != null) ? Math.max(0, shiftFund - busy) : null;
              const lost = (hourlyRate != null && idle != null) ? Math.round(hourlyRate * idle) : null;
              const tip = [
                date,
                shiftFund != null ? `${isRu ? 'Раб. фонд' : 'Fund'}: ${shiftFund} ${isRu ? 'ч' : 'h'}` : null,
                busy != null ? `${isRu ? 'Занят.' : 'Busy'}: ${busy} ${isRu ? 'ч' : 'h'}` : null,
                loadPct != null ? `${isRu ? 'Загрузка' : 'Load'}: ${loadPct}%` : null,
                earned != null ? `${isRu ? 'Заработ.' : 'Earned'}: ${earned} ${currency}` : null,
                lost != null ? `${isRu ? 'Потери' : 'Lost'}: ${lost} ${currency}` : null,
              ].filter(Boolean).join(' · ');

              return (
                <button
                  key={ci}
                  type="button"
                  onClick={() => onSelectDate?.(date)}
                  className="text-left rounded-lg p-1.5 hover:opacity-90 transition-all"
                  title={tip}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    minHeight: 60,
                  }}
                >
                  <div className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {dayMonthLabel(date)}
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
function buildWeekGrid(byDay) {
  if (!byDay.length) return [];
  const sorted = [...byDay].sort((a, b) => a.date.localeCompare(b.date));
  const weeks = [];
  let cur = new Array(7).fill(null);
  for (const cell of sorted) {
    const dow = isoDow(cell.date); // 1..7
    cur[dow - 1] = cell;
    if (dow === 7) {
      weeks.push(cur);
      cur = new Array(7).fill(null);
    }
  }
  if (cur.some(Boolean)) weeks.push(cur);
  return weeks;
}
