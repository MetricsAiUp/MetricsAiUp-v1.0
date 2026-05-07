// Сегментированный контрол выбора периода: Сегодня / Вчера / Неделя / Месяц / Период (custom).
// Возвращает в onChange объект { preset, from, to } — from/to ISO-строки или null.
//
// preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';

const PRESETS = ['today', 'yesterday', 'week', 'month', 'custom'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeForPreset(preset) {
  const now = new Date();
  if (preset === 'today') {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
  }
  if (preset === 'week') {
    const w = new Date(now);
    w.setDate(w.getDate() - 6);
    return { from: startOfDay(w).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'month') {
    const m = new Date(now);
    m.setDate(m.getDate() - 29);
    return { from: startOfDay(m).toISOString(), to: endOfDay(now).toISOString() };
  }
  return { from: null, to: null };
}

function toDateInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch { return ''; }
}

export default function PeriodPresets({ value, onChange, allowAll = true, compact = false }) {
  const { t } = useTranslation();
  const preset = value?.preset || (allowAll ? 'all' : 'week');
  const [customFrom, setCustomFrom] = useState(toDateInput(value?.from));
  const [customTo, setCustomTo] = useState(toDateInput(value?.to));

  useEffect(() => {
    setCustomFrom(toDateInput(value?.from));
    setCustomTo(toDateInput(value?.to));
  }, [value?.from, value?.to]);

  const setPreset = (p) => {
    if (p === 'custom') {
      const r = { from: customFrom ? new Date(customFrom).toISOString() : null,
                  to: customTo ? endOfDay(new Date(customTo)).toISOString() : null };
      onChange({ preset: 'custom', ...r });
      return;
    }
    if (p === 'all') {
      onChange({ preset: 'all', from: null, to: null });
      return;
    }
    const r = rangeForPreset(p);
    onChange({ preset: p, ...r });
  };

  const onCustomChange = (field, val) => {
    const next = field === 'from' ? { from: val, to: customTo } : { from: customFrom, to: val };
    if (field === 'from') setCustomFrom(val);
    else setCustomTo(val);
    onChange({
      preset: 'custom',
      from: next.from ? new Date(next.from).toISOString() : null,
      to: next.to ? endOfDay(new Date(next.to)).toISOString() : null,
    });
  };

  const btnBase = compact
    ? 'px-2.5 py-1 text-xs rounded-md transition-all whitespace-nowrap'
    : 'px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap';

  const btnStyle = (active) => ({
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 500,
  });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        {allowAll && (
          <button onClick={() => setPreset('all')} className={btnBase} style={btnStyle(preset === 'all')}>
            {t('data1c.period.all')}
          </button>
        )}
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setPreset(p)} className={btnBase} style={btnStyle(preset === p)}>
            {p === 'custom' && <Calendar size={12} className="inline mr-1 -mt-0.5" />}
            {t(`data1c.period.${p}`)}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomChange('from', e.target.value)}
            className="px-2 py-1 rounded-md text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomChange('to', e.target.value)}
            className="px-2 py-1 rounded-md text-sm"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }}
          />
        </div>
      )}
    </div>
  );
}
