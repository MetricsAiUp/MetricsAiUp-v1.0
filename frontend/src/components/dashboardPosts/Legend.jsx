import { STATUS_COLORS } from './constants';

// Legend showing status colors and current time indicator
export default function Legend({ t }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {Object.entries(STATUS_COLORS).map(([key, { bg }]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: bg }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t(`dashboardPosts.status_${key}`)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="w-4 h-0.5" style={{ background: 'var(--danger)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('dashboardPosts.currentTime')}
        </span>
      </div>
    </div>
  );
}
