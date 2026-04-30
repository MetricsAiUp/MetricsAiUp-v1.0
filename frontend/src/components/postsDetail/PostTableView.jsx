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
  if (type === 'zone') return name;
  const numStr = name?.match(/\d+/)?.[0];
  const num = numStr ? parseInt(numStr, 10) : null;
  if (num) return t(`posts.post${num}`);
  return name;
}

export default function PostTableView({ posts, navigate }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  return (
    <div className="glass rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--bg-glass)' }}>
              <th className="text-left px-3 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пост' : 'Post'}</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 160 }}>{isRu ? 'План / Факт / Простой' : 'Plan / Fact / Idle'}</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 110 }}>{t('postsDetail.load')}</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)', minWidth: 110 }}>{t('postsDetail.efficiency')}</th>
              <th className="text-center px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'ЗН' : 'WO'}</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Исполнители' : 'Workers'}</th>
              <th className="text-left px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Работы' : 'Works'}</th>
              <th className="text-center px-2 py-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Алерты' : 'Alerts'}</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map(post => {
              const d = post.today;
              const Icon = POST_TYPE_ICONS[post.type] || Car;
              const idleH = Math.max(0, Math.round((post.maxCapacityHours - d.factHours) * 10) / 10);
              const topWorkers = d.workers?.slice(0, 3) || [];
              const topWorks = d.workStats?.byGroup?.slice(0, 3) || [];
              const alertCount = d.alerts?.length || 0;
              const maxH = post.maxCapacityHours;
              return (
                <tr key={post.id} className="border-t cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ borderColor: 'var(--border-glass)' }}
                  onClick={() => navigate(`/posts-detail?${post.type === 'zone' ? 'zone' : 'post'}=${post.id}`)}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.loadPercent > 50 ? 'var(--success)' : d.loadPercent > 0 ? 'var(--warning)' : 'var(--text-muted)' }} />
                      <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{translatePostName(post.name, t, post.type)}</span>
                      <span className="text-xs px-1 rounded" style={{ background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '8px' }}>{t(`posts.${post.type}`)}</span>
                    </div>
                  </td>
                  {/* Plan/Fact/Idle mini bars */}
                  <td className="px-2 py-3">
                    <div className="space-y-1">
                      {[
                        { lbl: isRu ? 'План' : 'Plan', val: d.planHours, color: 'var(--accent)', pct: (d.planHours / maxH) * 100 },
                        { lbl: isRu ? 'Факт' : 'Fact', val: d.factHours, color: 'var(--success)', pct: (d.factHours / maxH) * 100 },
                        { lbl: isRu ? 'Прост' : 'Idle', val: idleH, color: 'var(--danger)', pct: (idleH / maxH) * 100 },
                      ].map((r, i) => (
                        <div key={i} className="flex items-center gap-1" style={{ fontSize: '10px' }}>
                          <span className="w-8 text-right" style={{ color: 'var(--text-muted)' }}>{r.lbl}</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border-glass)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(r.pct, 100)}%`, background: r.color }} />
                          </div>
                          <span className="w-8 font-semibold" style={{ color: r.color }}>{r.val}ч</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {/* Load */}
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border-glass)' }}>
                        <div className="h-full rounded-full" style={{ width: `${d.loadPercent}%`, background: loadColor(d.loadPercent) }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: loadColor(d.loadPercent) }}>{d.loadPercent}%</span>
                    </div>
                  </td>
                  {/* Efficiency */}
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border-glass)' }}>
                        <div className="h-full rounded-full" style={{ width: `${d.efficiency}%`, background: effColor(d.efficiency) }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: effColor(d.efficiency) }}>{d.efficiency}%</span>
                    </div>
                  </td>
                  {/* WO */}
                  <td className="text-center px-2 py-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{d.workOrders?.length || 0}</td>
                  {/* Workers */}
                  <td className="px-2 py-3">
                    <div className="space-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {topWorkers.map((w, i) => <div key={i} className="truncate" style={{ maxWidth: 110 }}>{w.name}</div>)}
                      {!topWorkers.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  </td>
                  {/* Works */}
                  <td className="px-2 py-3">
                    <div className="space-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {topWorks.map((w, i) => <div key={i} className="truncate" style={{ maxWidth: 110 }}>{w.group}</div>)}
                      {!topWorks.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  </td>
                  {/* Alerts */}
                  <td className="text-center px-2 py-3">
                    {alertCount > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', color: 'var(--warning)' }}>{alertCount}</span> : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-2 py-3"><ChevronRight size={14} style={{ color: 'var(--accent)' }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
