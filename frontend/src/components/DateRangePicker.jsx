import { useTranslation } from 'react-i18next';
import { dateStrInAppTz, dayOfWeekInAppTz, addDaysInAppTz } from '../utils/appTimezone';

// Все пресеты считаем в TZ Location (а не в TZ браузера), чтобы у пользователей
// в разных часовых поясах «сегодня/эта неделя» совпадали с тем, что считает backend.
const presets = [
  { key: 'today', getDates: () => { const d = dateStrInAppTz(); return [d, d]; } },
  { key: 'yesterday', getDates: () => { const d = addDaysInAppTz(dateStrInAppTz(), -1); return [d, d]; } },
  { key: 'thisWeek', getDates: () => {
    const today = dateStrInAppTz();
    // Понедельник как начало недели: сдвиг от текущего dow до пн (Mon=1..Sun=0).
    const dow = dayOfWeekInAppTz();
    const diff = (dow + 6) % 7;
    return [addDaysInAppTz(today, -diff), today];
  } },
  { key: 'thisMonth', getDates: () => {
    const today = dateStrInAppTz();
    return [today.slice(0, 7) + '-01', today];
  } },
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
