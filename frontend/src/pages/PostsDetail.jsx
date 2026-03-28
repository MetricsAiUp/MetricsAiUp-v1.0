import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.BASE_URL || './';
const fetchApi = async (path) => {
  const res = await fetch(`${BASE}api/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend as RLegend,
} from 'recharts';
import {
  Car, Truck, Wrench, Clock, User, AlertTriangle, ScrollText,
  Camera, Image, ChevronRight, BarChart3, Calendar, FileText,
  CircleDot, Timer, X, Users, Activity, Eye,
} from 'lucide-react';

const POST_TYPE_ICONS = { light: Car, heavy: Truck, diagnostics: Wrench };
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const STATUS_COLORS = {
  completed: 'var(--success)',
  in_progress: 'var(--accent)',
  scheduled: 'var(--text-muted)',
};
const SEVERITY_COLORS = { warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)' };

function formatTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// Summary cards at top of detail panel
function SummaryCards({ post, t }) {
  const d = post.today;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* Plan vs Fact chart */}
      <div className="col-span-2 glass rounded-xl p-3" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          {t('postsDetail.planVsFact')}
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={[{ name: t('postsDetail.plan'), hours: d.planHours }, { name: t('postsDetail.fact'), hours: d.factHours }, { name: t('postsDetail.maxCapacity'), hours: post.maxCapacityHours }]} layout="vertical">
            <XAxis type="number" domain={[0, post.maxCapacityHours]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
              <Cell fill="var(--accent)" />
              <Cell fill="var(--success)" />
              <Cell fill="var(--text-muted)" opacity={0.3} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Load % */}
      <div className="glass rounded-xl p-3" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-1 mb-1">
          <Activity size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.load')}</span>
        </div>
        <div className="text-2xl font-bold" style={{ color: d.loadPercent > 80 ? 'var(--danger)' : d.loadPercent > 50 ? 'var(--warning)' : 'var(--success)' }}>
          {d.loadPercent}%
        </div>
        <div className="w-full h-1.5 rounded-full mt-2" style={{ background: 'var(--border-glass)' }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${d.loadPercent}%`,
            background: d.loadPercent > 80 ? 'var(--danger)' : d.loadPercent > 50 ? 'var(--warning)' : 'var(--success)',
          }} />
        </div>
      </div>

      {/* Efficiency */}
      <div className="glass rounded-xl p-3" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-1 mb-1">
          <BarChart3 size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.efficiency')}</span>
        </div>
        <div className="text-2xl font-bold" style={{ color: d.efficiency > 80 ? 'var(--success)' : d.efficiency > 50 ? 'var(--warning)' : 'var(--danger)' }}>
          {d.efficiency}%
        </div>
        <div className="w-full h-1.5 rounded-full mt-2" style={{ background: 'var(--border-glass)' }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${d.efficiency}%`,
            background: d.efficiency > 80 ? 'var(--success)' : d.efficiency > 50 ? 'var(--warning)' : 'var(--danger)',
          }} />
        </div>
      </div>
    </div>
  );
}

// Work orders sub-section
function WorkOrdersSection({ workOrders, t, onShowAll }) {
  const visible = workOrders.slice(0, 3);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('postsDetail.workOrders')} ({workOrders.length})
          </span>
        </div>
        {workOrders.length > 3 && (
          <button onClick={onShowAll} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--accent)' }}>
            {t('postsDetail.showAll')} <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {visible.map(wo => (
          <div key={wo.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[wo.status] }} />
            <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{wo.orderNumber}</span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{wo.plateNumber}</span>
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{wo.workType}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{wo.normHours}ч</span>
            {wo.planVsFact != null && (
              <span className="text-xs font-medium" style={{ color: wo.planVsFact <= 100 ? 'var(--success)' : 'var(--danger)' }}>
                {wo.planVsFact}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Workers sub-section
function WorkersSection({ workers, t, onShowAll }) {
  if (!workers.length) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('postsDetail.workers')} ({workers.length})
          </span>
        </div>
        {workers.length > 3 && (
          <button onClick={onShowAll} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--accent)' }}>
            {t('postsDetail.showAll')} <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {workers.map(w => (
          <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <User size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.role}</span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{w.hoursWorked}ч / {w.ordersCompleted} ЗН</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Alerts sub-section
function AlertsSection({ alerts, t, onShowAll }) {
  if (!alerts.length) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('postsDetail.alerts')} ({alerts.length})
          </span>
        </div>
        {alerts.length > 3 && (
          <button onClick={onShowAll} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--accent)' }}>
            {t('postsDetail.showAll')} <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {alerts.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: `1px solid ${SEVERITY_COLORS[a.severity] || 'var(--border-glass)'}` }}>
            <AlertTriangle size={12} style={{ color: SEVERITY_COLORS[a.severity] || 'var(--warning)' }} />
            <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{a.message}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(a.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Event log sub-section
function EventLogSection({ events, t, onShowAll }) {
  if (!events.length) return null;
  const visible = events.slice(0, 5);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ScrollText size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('postsDetail.eventLog')} ({events.length})
          </span>
        </div>
        {events.length > 5 && (
          <button onClick={onShowAll} className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--accent)' }}>
            {t('postsDetail.showAll')} <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div className="space-y-1">
        {visible.map(ev => (
          <div key={ev.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:opacity-80" style={{ background: 'var(--bg-glass)' }}>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(ev.time)}</span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Statistics charts
function StatsSection({ stats, t }) {
  if (!stats) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('postsDetail.statistics')}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Work by group */}
        <div className="glass rounded-xl p-3" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.workByGroup')}</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={stats.byGroup}>
              <XAxis dataKey="group" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {stats.byGroup.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cars by brand */}
        <div className="glass rounded-xl p-3" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.carsByBrand')}</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={stats.byBrand} dataKey="count" nameKey="brand" cx="50%" cy="50%" outerRadius={45} label={({ brand }) => brand} labelLine={false}>
                {stats.byBrand.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.avgTime')}: </span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{stats.avgTimePerOrder} ч</span>
      </div>
    </div>
  );
}

// Cameras sub-section
function CamerasSection({ cameras, plateImage, t }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Camera size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('postsDetail.cameras')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cameras.map(cam => (
          <div key={cam.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <div className="aspect-video flex items-center justify-center" style={{ background: '#1a1a2e' }}>
              <Camera size={24} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{cam.name}</span>
              <Eye size={12} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        ))}
      </div>
      {/* Plate image */}
      <div className="mt-2 rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <Image size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.plateImage')}</span>
        {plateImage ? (
          <img src={plateImage} alt="plate" className="h-8 rounded" />
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// Calendar heatmap
function CalendarSection({ calendar, post, t }) {
  if (!calendar || !calendar.length) return null;

  const getColor = (val) => {
    if (val >= 80) return 'var(--success)';
    if (val >= 50) return 'var(--warning)';
    if (val > 0) return 'var(--danger)';
    return 'var(--text-muted)';
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('postsDetail.calendarLoad')}
        </span>
      </div>
      <div className="glass rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--bg-glass)' }}>
              <th className="px-2 py-1.5 text-left" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.date')}</th>
              <th className="px-2 py-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.load')}</th>
              <th className="px-2 py-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.efficiency')}</th>
              <th className="px-2 py-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.normHoursShort')}</th>
            </tr>
          </thead>
          <tbody>
            {calendar.map(day => (
              <tr key={day.date} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--text-primary)' }}>{formatDate(day.date)}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className="inline-block px-2 py-0.5 rounded-full font-medium" style={{ background: getColor(day.loadPercent), color: '#fff', fontSize: '10px' }}>
                    {day.loadPercent}%
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className="inline-block px-2 py-0.5 rounded-full font-medium" style={{ background: getColor(day.efficiency), color: '#fff', fontSize: '10px' }}>
                    {day.efficiency}%
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center font-medium" style={{ color: 'var(--text-primary)' }}>
                  {day.normHours}ч
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Popup modal for full lists
function ListModal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-5 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Main component
export default function PostsDetail() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [period, setPeriod] = useState('today');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchApi('posts-analytics')
      .then(res => {
        setData(res);
        if (res.posts?.length > 0) {
          setSelectedPostId(res.posts[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedPost = useMemo(() => {
    if (!data?.posts || !selectedPostId) return null;
    return data.posts.find(p => p.id === selectedPostId);
  }, [data, selectedPostId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  const posts = data?.posts || [];

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* Left sidebar - posts list */}
      <div
        className="flex-shrink-0 overflow-y-auto glass-static p-2 space-y-1"
        style={{ width: 180, minWidth: 180, borderRight: '1px solid var(--border-glass)' }}
      >
        <div className="text-xs font-bold px-2 py-1 mb-1" style={{ color: 'var(--text-muted)' }}>
          {t('postsDetail.postsList')}
        </div>
        {posts.map(post => {
          const Icon = POST_TYPE_ICONS[post.type] || Car;
          const isSelected = post.id === selectedPostId;
          return (
            <button
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="w-full text-left px-2 py-2 rounded-lg transition-all flex items-center gap-2"
              style={{
                background: isSelected ? 'var(--accent-light)' : 'transparent',
                color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: post.today.loadPercent > 0 ? 'var(--success)' : 'var(--text-muted)' }}
              />
              <Icon size={13} style={{ flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{post.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                  {t(`posts.${post.type}`)} · {post.today.loadPercent}%
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right panel - detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedPost ? (
          <>
            {/* Post header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {selectedPost.name}
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {t(`posts.${selectedPost.type}`)}
                  </span>
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedPost.zone}</p>
              </div>
              {/* Period selector */}
              <div className="flex gap-1">
                {[
                  { key: 'today', label: t('postsDetail.today') },
                  { key: 'yesterday', label: t('postsDetail.yesterday') },
                  { key: 'week', label: t('postsDetail.week') },
                  { key: 'month', label: t('postsDetail.month') },
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className="px-2 py-1 rounded-lg text-xs transition-all"
                    style={{
                      background: period === p.key ? 'var(--accent)' : 'var(--bg-glass)',
                      color: period === p.key ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${period === p.key ? 'var(--accent)' : 'var(--border-glass)'}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <SummaryCards post={selectedPost} t={t} />

            {/* Work Orders */}
            <WorkOrdersSection
              workOrders={selectedPost.today.workOrders}
              t={t}
              onShowAll={() => setModal({ type: 'workOrders', data: selectedPost.today.workOrders })}
            />

            {/* Workers */}
            <WorkersSection
              workers={selectedPost.today.workers}
              t={t}
              onShowAll={() => setModal({ type: 'workers', data: selectedPost.today.workers })}
            />

            {/* Alerts */}
            <AlertsSection
              alerts={selectedPost.today.alerts}
              t={t}
              onShowAll={() => setModal({ type: 'alerts', data: selectedPost.today.alerts })}
            />

            {/* Event Log */}
            <EventLogSection
              events={selectedPost.today.eventLog}
              t={t}
              onShowAll={() => setModal({ type: 'events', data: selectedPost.today.eventLog })}
            />

            {/* Statistics */}
            <StatsSection stats={selectedPost.today.workStats} t={t} />

            {/* Cameras */}
            <CamerasSection
              cameras={selectedPost.today.cameras}
              plateImage={selectedPost.today.currentPlateImage}
              t={t}
            />

            {/* Calendar */}
            <CalendarSection calendar={selectedPost.calendar} post={selectedPost} t={t} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
            {t('postsDetail.selectPost')}
          </div>
        )}
      </div>

      {/* Modal for full lists */}
      {modal && (
        <ListModal
          title={t(`postsDetail.${modal.type === 'workOrders' ? 'allWorkOrders' : modal.type === 'workers' ? 'allWorkers' : modal.type === 'alerts' ? 'allAlerts' : 'allEvents'}`)}
          onClose={() => setModal(null)}
        >
          {modal.type === 'workOrders' && (
            <div className="space-y-2">
              {modal.data.map(wo => (
                <div key={wo.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[wo.status] }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{wo.orderNumber}</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{wo.plateNumber}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{wo.brand} {wo.model}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{wo.workType}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{wo.normHours}ч / {wo.actualHours ?? '—'}ч</div>
                    {wo.planVsFact != null && <div className="text-xs font-medium" style={{ color: wo.planVsFact <= 100 ? 'var(--success)' : 'var(--danger)' }}>{wo.planVsFact}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'workers' && (
            <div className="space-y-2">
              {modal.data.map(w => (
                <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                  <User size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w.role}</span>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{w.hoursWorked}ч / {w.ordersCompleted} ЗН</span>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'alerts' && (
            <div className="space-y-2">
              {modal.data.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: `1px solid ${SEVERITY_COLORS[a.severity]}` }}>
                  <AlertTriangle size={14} style={{ color: SEVERITY_COLORS[a.severity] }} />
                  <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{a.message}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(a.time)}</span>
                </div>
              ))}
            </div>
          )}
          {modal.type === 'events' && (
            <div className="space-y-1">
              {modal.data.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(ev.time)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.description}</span>
                </div>
              ))}
            </div>
          )}
        </ListModal>
      )}
    </div>
  );
}
