import { Wrench, Square, CheckCircle2, Circle, AlertTriangle, Clock } from 'lucide-react';
import { STATUS_COLORS } from './constants';

function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Карточка одного цвета — крупный квадрат, иконка, краткий заголовок и пояснение.
function Swatch({ color, Icon, title, hint }) {
  const tint = color?.startsWith('#') ? hexA(color, 0.12) : 'var(--bg-glass)';
  const border = color?.startsWith('#') ? hexA(color, 0.35) : 'var(--border-glass)';
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{ background: tint, border: `1px solid ${border}` }}
    >
      <div
        className="flex items-center justify-center rounded"
        style={{ width: 22, height: 22, background: color, flexShrink: 0 }}
      >
        {Icon && <Icon size={13} strokeWidth={2.5} style={{ color: '#fff' }} />}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      </div>
    </div>
  );
}

// Палитра единая с картой СТО (см. constants/index.js).
// Live-режим: блоки = визиты CV. 4 состояния визита:
//   active_work (индиго)   — идут работы
//   occupied (оранжевый)   — авто на посту, без работ
//   completed (зелёный)    — авто уехало после работ
//   scheduled (серый)      — авто проехало без работ
// Demo-режим: блоки = ЗН с жизненным циклом (scheduled/in_progress/completed/overdue).
export default function Legend({ t, isLive }) {
  const liveItems = [
    {
      key: 'active_work',
      color: STATUS_COLORS.active_work.bg,
      Icon: Wrench,
      title: t('dashboardPosts.legend_visit_with_work_title'),
      hint: t('dashboardPosts.legend_visit_with_work'),
    },
    {
      key: 'occupied',
      color: STATUS_COLORS.occupied.bg,
      Icon: Square,
      title: t('dashboardPosts.legend_visit_occupied_title'),
      hint: t('dashboardPosts.legend_visit_occupied'),
    },
    {
      key: 'completed',
      color: STATUS_COLORS.completed.bg,
      Icon: CheckCircle2,
      title: t('dashboardPosts.legend_visit_done_title'),
      hint: t('dashboardPosts.legend_visit_done'),
    },
    {
      key: 'scheduled',
      color: STATUS_COLORS.scheduled.bg,
      Icon: Circle,
      title: t('dashboardPosts.legend_visit_idle_title'),
      hint: t('dashboardPosts.legend_visit_idle'),
    },
  ];

  const demoItems = [
    { key: 'scheduled',   color: STATUS_COLORS.scheduled.bg,   Icon: Circle,         title: t('dashboardPosts.status_scheduled'),   hint: t('dashboardPosts.legend_demo_scheduled') },
    { key: 'in_progress', color: STATUS_COLORS.in_progress.bg, Icon: Wrench,         title: t('dashboardPosts.status_in_progress'), hint: t('dashboardPosts.legend_demo_in_progress') },
    { key: 'completed',   color: STATUS_COLORS.completed.bg,   Icon: CheckCircle2,   title: t('dashboardPosts.status_completed'),   hint: t('dashboardPosts.legend_demo_completed') },
    { key: 'overdue',     color: STATUS_COLORS.overdue.bg,     Icon: AlertTriangle,  title: t('dashboardPosts.status_overdue'),     hint: t('dashboardPosts.legend_demo_overdue') },
  ];

  const items = isLive ? liveItems : demoItems;
  const heading = isLive
    ? t('dashboardPosts.legend_heading_live')
    : t('dashboardPosts.legend_heading_demo');

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
          {heading}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
             style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <Clock size={11} style={{ color: 'var(--danger)' }} />
          <div className="w-3 h-0.5" style={{ background: 'var(--danger)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t('dashboardPosts.currentTime')}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <Swatch key={item.key} color={item.color} Icon={item.Icon} title={item.title} hint={item.hint} />
        ))}
      </div>
    </div>
  );
}
