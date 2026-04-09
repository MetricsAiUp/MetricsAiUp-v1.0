import { useTranslation } from 'react-i18next';

const presets = [
  { key: 'today', getDates: () => { const d = new Date().toISOString().slice(0, 10); return [d, d]; } },
  { key: 'yesterday', getDates: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().slice(0, 10); return [s, s]; } },
  { key: 'thisWeek', getDates: () => { const now = new Date(); const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [d.toISOString().slice(0, 10), now.toISOString().slice(0, 10)]; } },
  { key: 'thisMonth', getDates: () => { const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth(), 1); return [d.toISOString().slice(0, 10), now.toISOString().slice(0, 10)]; } },
  { key: 'allDates', getDates: () => ['', ''] },
];

export default function DateRangePicker({ dateFrom, dateTo, onDateFromChange, onDateToChange, ns = 'workOrders' }) {
  const { t } = useTranslation();

  const handlePreset = (preset) => {
    const [from, to] = preset.getDates();
    onDateFromChange(from);
    onDateToChange(to);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="flex items-center gap-1.5">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`${ns}.dateFrom`)}</label>
        <input
          type="date"
          value={dateFrom}
          onChange={e => onDateFromChange(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`${ns}.dateTo`)}</label>
        <input
          type="date"
          value={dateTo}
          onChange={e => onDateToChange(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
        />
      </div>
      <div className="flex gap-1">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            className="px-2 py-1 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}
          >
            {t(`${ns}.${p.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
