import { useTranslation } from 'react-i18next';

const DAY_NAMES = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function getColor(pct) {
  if (pct >= 80) return 'rgba(239,68,68,0.6)';
  if (pct >= 60) return 'rgba(239,68,68,0.35)';
  if (pct >= 40) return 'rgba(234,179,8,0.4)';
  if (pct >= 20) return 'rgba(34,197,94,0.3)';
  return 'rgba(34,197,94,0.1)';
}

export default function WeeklyHeatmap({ data, isRu }) {
  const { t } = useTranslation();
  const dayNames = DAY_NAMES[isRu ? 'ru' : 'en'];

  if (!data || data.length === 0) return null;

  return (
    <div>
      <table className="w-full text-xs table-fixed">
        <thead>
          <tr>
            <th className="text-left px-1 py-1" style={{ color: 'var(--text-muted)', width: '7%' }}>
              {isRu ? 'День' : 'Day'}
            </th>
            {Array.from({ length: 12 }, (_, i) => i + 8).map(h => (
              <th key={h} className="text-center px-0 py-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {h}:00
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.dayIndex}>
              <td className="px-1 py-0.5 font-medium" style={{ color: 'var(--text-primary)', fontSize: 10 }}>
                {dayNames[row.dayIndex]}
              </td>
              {row.hours.map((h, hi) => {
                const pct = h.avgOccupancy;
                return (
                  <td key={hi} className="text-center px-0 py-0.5 relative group">
                    <div className="rounded" style={{ background: getColor(pct), padding: '2px 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: 9 }}>
                      {pct}%
                    </div>
                    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
                      style={{ background: 'rgba(15,23,42,0.95)', color: '#f1f5f9', fontSize: 10, border: '1px solid rgba(148,163,184,0.2)' }}>
                      <div className="font-bold">{dayNames[row.dayIndex]} — {h.hour}:00</div>
                      <div>{t('analytics.heatmapOccupancy')}: {pct}%</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{isRu ? 'Шкала:' : 'Scale:'}</span>
        {[
          { bg: 'rgba(34,197,94,0.1)', label: '0-20%' },
          { bg: 'rgba(34,197,94,0.3)', label: '20-40%' },
          { bg: 'rgba(234,179,8,0.4)', label: '40-60%' },
          { bg: 'rgba(239,68,68,0.35)', label: '60-80%' },
          { bg: 'rgba(239,68,68,0.6)', label: '80-100%' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ background: s.bg }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
