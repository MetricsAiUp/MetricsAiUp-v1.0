import { STATUS_COLORS } from './constants';

// Legend showing status colors and current time indicator
// В live-режиме блоки = визиты CV (auto на посту). Только два цвета используются:
// фиолетовый (была работа) / серый (стояло без работ). Зелёный/красный не используются.
// В demo-режиме блоки = ЗН с полным жизненным циклом → все 4 статуса актуальны.
export default function Legend({ t, isLive }) {
  const liveItems = [
    { key: 'in_progress', bg: STATUS_COLORS.in_progress.bg, labelKey: 'dashboardPosts.legend_visit_with_work' },
    { key: 'scheduled', bg: STATUS_COLORS.scheduled.bg, labelKey: 'dashboardPosts.legend_visit_idle' },
    { key: 'free', bg: STATUS_COLORS.completed.bg, labelKey: 'dashboardPosts.legend_post_free' },
  ];
  const items = isLive
    ? liveItems
    : Object.entries(STATUS_COLORS).map(([key, { bg }]) => ({ key, bg, labelKey: `dashboardPosts.status_${key}` }));

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {items.map(item => (
        <div key={item.key} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: item.bg }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t(item.labelKey)}
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
