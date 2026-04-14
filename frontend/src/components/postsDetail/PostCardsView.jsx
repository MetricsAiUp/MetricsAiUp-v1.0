import { useTranslation } from 'react-i18next';
import { Car, Truck, Wrench, ChevronRight } from 'lucide-react';

const POST_TYPE_ICONS = { light: Car, heavy: Truck, diagnostics: Wrench, zone: Wrench, special: Wrench };

function loadColor(v) {
  if (v >= 70) return 'var(--success)';
  if (v >= 30) return 'var(--warning)';
  return 'var(--danger)';
}

function effColor(v) {
  if (v >= 80) return 'var(--success)';
  if (v >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function translatePostName(name, t, type) {
  if (type === 'zone') return name; // zones keep their name as-is
  const num = name?.match(/\d+/)?.[0];
  if (num) return t(`posts.post${num}`);
  return name;
}

export default function PostCardsView({ posts, navigate }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {posts.map(post => {
        const d = post.today;
        const Icon = POST_TYPE_ICONS[post.type] || Car;
        const idleH = Math.max(0, Math.round((post.maxCapacityHours - d.factHours) * 10) / 10);
        const topWorkers = d.workers?.slice(0, 3) || [];
        const topWorks = d.workStats?.byGroup?.slice(0, 3) || [];
        const alertCount = d.alerts?.length || 0;
        return (
          <div key={post.id} className="glass rounded-xl p-4 hover:shadow-lg transition-all"
            style={{ border: '1px solid var(--border-glass)' }}
            onClick={() => navigate(`/posts-detail?${post.type === 'zone' ? 'zone' : 'post'}=${post.id}`)}>
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.loadPercent > 50 ? 'var(--success)' : d.loadPercent > 0 ? 'var(--warning)' : 'var(--text-muted)' }} />
                <Icon size={14} style={{ color: 'var(--text-secondary)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{translatePostName(post.name, t, post.type)}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '9px' }}>{t(`posts.${post.type}`)}</span>
              </div>
              {alertCount > 0 && (
                <div className="relative group">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--warning)' }}>{alertCount}</span>
                  <div className="absolute top-full right-0 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                    style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 140, fontSize: '11px', textAlign: 'center' }}>
                    {isRu ? 'Нарушения и замечания' : 'Alerts and warnings'}
                  </div>
                </div>
              )}
            </div>

            {/* Plan / Fact / Max / Idle / Turbo row */}
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {[
                { label: isRu ? 'План' : 'Plan', value: `${d.planHours}ч`, color: 'var(--accent)', tip: isRu ? 'Плановые часы работ на посту' : 'Planned work hours' },
                { label: isRu ? 'Факт' : 'Fact', value: `${d.factHours}ч`, color: 'var(--success)', tip: isRu ? 'Фактически отработанные часы' : 'Actual hours worked' },
                { label: isRu ? 'Макс' : 'Max', value: `${post.maxCapacityHours}ч`, color: 'var(--text-muted)', tip: isRu ? 'Максимальная ёмкость поста за смену' : 'Max post capacity per shift' },
                { label: isRu ? 'Простой' : 'Idle', value: `${idleH}ч`, color: idleH > 4 ? 'var(--danger)' : 'var(--text-muted)', tip: isRu ? 'Время когда пост был свободен' : 'Time post was idle' },
                { label: isRu ? 'Турбо' : 'Turbo', value: `${Math.max(0, Math.round((d.planHours - d.factHours) * 10) / 10)}ч`, color: 'var(--success)', tip: isRu ? 'Сэкономленное время (план минус факт)' : 'Saved time (plan minus actual)' },
              ].map((m, i) => (
                <div key={i} className="text-center px-1 py-1.5 rounded-lg relative group" style={{ background: 'var(--bg-glass)' }}>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                    style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 160, fontSize: '11px', lineHeight: 1.3, textAlign: 'center' }}>
                    {m.tip}
                  </div>
                  <div className="text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Load + Efficiency bars */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 relative group">
                <span className="text-xs w-24" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.load')}</span>
                <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--border-glass)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.loadPercent}%`, background: loadColor(d.loadPercent) }} />
                </div>
                <span className="text-xs font-bold w-10 text-right" style={{ color: loadColor(d.loadPercent) }}>{d.loadPercent}%</span>
                <div className="absolute top-full left-24 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 180, fontSize: '11px', textAlign: 'center' }}>
                  {isRu ? 'Процент загрузки поста за смену' : 'Post load percentage for the shift'}
                </div>
              </div>
              <div className="flex items-center gap-2 relative group">
                <span className="text-xs w-24" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.efficiency')}</span>
                <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--border-glass)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.efficiency}%`, background: effColor(d.efficiency) }} />
                </div>
                <span className="text-xs font-bold w-10 text-right" style={{ color: effColor(d.efficiency) }}>{d.efficiency}%</span>
                <div className="absolute top-full left-24 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 180, fontSize: '11px', textAlign: 'center' }}>
                  {isRu ? 'Эффективность использования рабочего времени' : 'Work time utilization efficiency'}
                </div>
              </div>
            </div>

            {/* WO count + workers + works */}
            <div className="flex items-start gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="relative group">
                <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{d.workOrders?.length || 0}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{isRu ? 'ЗН' : 'WO'}</div>
                <div className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 140, fontSize: '11px', textAlign: 'center' }}>
                  {isRu ? 'Заказ-наряды на посту' : 'Work orders on post'}
                </div>
              </div>
              <div className="flex-1 min-w-0 relative group">
                <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: 2 }}>{isRu ? 'Исполнители' : 'Workers'}</div>
                {topWorkers.map((w, i) => <div key={i} className="truncate">{w.name}</div>)}
                {!topWorkers.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                <div className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 160, fontSize: '11px', textAlign: 'center' }}>
                  {isRu ? 'ТОП-3 исполнителей на посту' : 'Top 3 workers on post'}
                </div>
              </div>
              <div className="flex-1 min-w-0 relative group">
                <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: 2 }}>{isRu ? 'Работы' : 'Works'}</div>
                {topWorks.map((w, i) => <div key={i} className="truncate">{w.group}</div>)}
                {!topWorks.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                <div className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                  style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 160, fontSize: '11px', textAlign: 'center' }}>
                  {isRu ? 'ТОП-3 типов работ на посту' : 'Top 3 work types on post'}
                </div>
              </div>
            </div>

            {/* Footer link */}
            <div className="mt-3 pt-2 text-xs text-right" style={{ borderTop: '1px solid var(--border-glass)', color: 'var(--accent)' }}>
              {t('postsDetail.goToPost')} <ChevronRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
