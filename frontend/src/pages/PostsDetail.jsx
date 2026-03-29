import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
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
  Camera, Image, ChevronRight, ChevronDown, BarChart3, Calendar, FileText,
  CircleDot, Timer, X, Users, Activity, Eye,
} from 'lucide-react';

const POST_TYPE_ICONS = { light: Car, heavy: Truck, diagnostics: Wrench };

// Translate post name: "Пост 1" → t('posts.post1')
function translatePostName(name, t) {
  const num = name?.match(/\d+/)?.[0];
  if (num) return t(`posts.post${num}`);
  return name;
}

// Translate zone name from mock data
function translateZoneName(zone, t) {
  if (!zone) return '';
  if (zone.includes('5-9') || zone.includes('5-8')) return t('posts.repairZone59');
  if (zone.includes('1-4')) return t('posts.repairZone1410');
  if (zone.includes('Ремонтная') || zone.includes('Repair')) return t('posts.repairZone');
  if (zone.includes('Проезд') || zone.includes('Driveway')) return t('posts.driveway');
  if (zone.includes('Парковка') || zone.includes('Parking')) return t('posts.parking');
  if (zone.includes('Въезд') || zone.includes('Entry')) return t('posts.entryExit');
  return zone;
}
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
// Загрузка: >=70% зелёная (хорошо), 30-70% жёлтая, <30% красная (плохо)
function loadColor(v) {
  if (v >= 70) return 'var(--success)';
  if (v >= 30) return 'var(--warning)';
  return 'var(--danger)';
}
// Эффективность: >=80% зелёная, 50-80% жёлтая, <50% красная
function effColor(v) {
  if (v >= 80) return 'var(--success)';
  if (v >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function SummaryCards({ post, t }) {
  const d = post.today;
  const maxH = post.maxCapacityHours;
  return (
    <div className="flex gap-3 mb-4">
      {/* Plan / Fact / Max — bar chart style */}
      <div className="flex-1 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.planVsFact')}</div>
        {[
          { label: t('postsDetail.plan'), value: d.planHours, color: 'var(--accent)' },
          { label: t('postsDetail.fact'), value: d.factHours, color: 'var(--success)' },
          { label: t('postsDetail.maxCapacity'), value: maxH, color: 'var(--text-muted)', opacity: 0.3 },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="text-xs w-10 text-right" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--border-glass)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(row.value / maxH) * 100}%`, background: row.color, opacity: row.opacity || 1 }} />
            </div>
            <span className="text-xs font-bold w-8" style={{ color: row.color }}>{row.value}ч</span>
          </div>
        ))}
      </div>

      {/* Load + Efficiency — stacked */}
      <div className="flex flex-col gap-2" style={{ minWidth: 180 }}>
        {/* Load % */}
        <div className="px-3 py-2 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Activity size={11} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.load')}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: loadColor(d.loadPercent) }}>{d.loadPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'var(--border-glass)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${d.loadPercent}%`, background: loadColor(d.loadPercent) }} />
          </div>
        </div>

        {/* Efficiency */}
        <div className="px-3 py-2 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <BarChart3 size={11} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.efficiency')}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: effColor(d.efficiency) }}>{d.efficiency}%</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'var(--border-glass)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${d.efficiency}%`, background: effColor(d.efficiency) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Collapsible section wrapper
function CollapsibleSection({ icon: Icon, title, count, color, children, extra }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 mb-1.5 w-full text-left hover:opacity-80 transition-opacity">
        <Icon size={14} style={{ color: color || 'var(--accent)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {title} {count != null && `(${count})`}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto' }} />
        {extra && <div className="ml-auto mr-4" onClick={e => e.stopPropagation()}>{extra}</div>}
      </button>
      {open && children}
    </div>
  );
}

function WorkOrdersSection({ workOrders, t }) {
  const visible = workOrders.slice(0, 5);
  return (
    <div>
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
function WorkersSection({ workers, t }) {
  if (!workers.length) return null;
  return (
    <div>
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
function AlertsSection({ alerts, t }) {
  if (!alerts.length) return null;
  return (
    <div>
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
function EventLogSection({ events, t }) {
  if (!events.length) return null;
  const visible = events.slice(0, 5);
  return (
    <div>
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
  const maxHours = Math.max(...stats.byGroup.map(g => g.hours), 1);
  const maxCount = Math.max(...stats.byBrand.map(b => b.count), 1);
  return (
    <div>
      <div className="text-xs mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
        {t('postsDetail.avgTime')}: <strong>{stats.avgTimePerOrder}ч</strong>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Work by group — horizontal bars */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.workByGroup')}</div>
          <div className="space-y-1">
            {stats.byGroup.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-right" style={{ color: 'var(--text-secondary)' }}>{g.group}</span>
                <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--border-glass)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(g.hours / maxHours) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <span className="text-xs font-medium w-8" style={{ color: 'var(--text-primary)' }}>{g.hours}ч</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cars by brand — horizontal bars */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('postsDetail.carsByBrand')}</div>
          <div className="space-y-1">
            {stats.byBrand.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-right" style={{ color: 'var(--text-secondary)' }}>{b.brand}</span>
                <div className="flex-1 h-3 rounded-full" style={{ background: 'var(--border-glass)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
                <span className="text-xs font-medium w-6" style={{ color: 'var(--text-primary)' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Cameras sub-section
function CamerasSection({ cameras, plateImage, t }) {
  return (
    <div>
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
    <div>
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

const TL_COLORS = {
  completed: { bg: 'var(--success)', text: '#fff' },
  in_progress: { bg: 'var(--accent)', text: '#fff' },
  scheduled: { bg: 'var(--text-muted)', text: '#fff' },
  overdue: { bg: 'var(--danger)', text: '#fff' },
};

function PostTimeline({ dashPost, shiftStart = '08:00', shiftEnd = '20:00' }) {
  if (!dashPost?.timeline?.length) return null;

  const startH = parseInt(shiftStart.split(':')[0], 10);
  const endH = parseInt(shiftEnd.split(':')[0], 10);
  const total = endH - startH;

  const getPos = (timeStr) => {
    const d = new Date(timeStr);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, Math.min(100, ((h - startH) / total) * 100));
  };

  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
  const nowPos = Math.max(0, Math.min(100, ((nowH - startH) / total) * 100));

  // Ticks: hours + half-hours
  const ticks = [];
  for (let h = startH; h <= endH; h++) {
    ticks.push({ h, m: 0, isHour: true });
    if (h < endH) ticks.push({ h, m: 30, isHour: false });
  }

  return (
    <div className="glass rounded-xl p-3 mb-4" style={{ border: '1px solid var(--border-glass)' }}>
      {/* Hour labels */}
      <div className="relative h-5 mb-1">
        {ticks.map(({ h, m, isHour }) => {
          const pos = ((h - startH + m / 60) / total) * 100;
          return (
            <span key={`${h}:${m}`} className="absolute" style={{
              left: `${pos}%`, transform: 'translateX(-50%)',
              color: isHour ? 'var(--text-secondary)' : 'var(--text-muted)',
              fontSize: isHour ? '10px' : '8px', top: isHour ? 0 : 2,
            }}>
              {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
            </span>
          );
        })}
      </div>
      {/* Timeline bar */}
      <div className="relative rounded" style={{ height: 32, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        {/* Grid lines */}
        {ticks.map(({ h, m, isHour }) => {
          const pos = ((h - startH + m / 60) / total) * 100;
          return (
            <div key={`g${h}:${m}`} className="absolute top-0 bottom-0" style={{
              left: `${pos}%`, width: 1,
              background: 'var(--text-muted)', opacity: isHour ? 0.3 : 0.12,
            }} />
          );
        })}
        {/* WO blocks */}
        {dashPost.timeline.map(item => {
          const left = getPos(item.startTime);
          const end = item.endTime || item.estimatedEnd || item.startTime;
          const width = Math.max(3, getPos(end) - left);
          const isOverdue = item.status === 'in_progress' && item.estimatedEnd && new Date() > new Date(item.estimatedEnd);
          const status = isOverdue ? 'overdue' : item.status;
          const colors = TL_COLORS[status] || TL_COLORS.scheduled;
          return (
            <div key={item.id} className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5 overflow-hidden cursor-pointer hover:opacity-90"
              style={{ left: `${left}%`, width: `${width}%`, background: colors.bg, color: colors.text, minWidth: 30, marginRight: 2 }}
              title={`${item.workOrderNumber} — ${item.workType}`}
            >
              <span className="font-medium truncate" style={{ fontSize: '9px' }}>{item.workOrderNumber}</span>
            </div>
          );
        })}
        {/* Now indicator */}
        <div className="absolute top-0 bottom-0" style={{ left: `${nowPos}%`, width: 2, background: 'var(--danger)', zIndex: 3 }}>
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
        </div>
      </div>
    </div>
  );
}

// Main component
export default function PostsDetail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [modal, setModal] = useState(null);

  const selectedPostId = searchParams.get('post') || null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchApi('posts-analytics'),
      fetchApi('dashboard-posts'),
    ])
      .then(([res, dash]) => { setData(res); setDashData(dash); })
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
    <div className="p-4">
      {/* Detail content */}
      <div>
        {selectedPost ? (
          <>
            {/* Post header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {translatePostName(selectedPost.name, t)}
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {t(`posts.${selectedPost.type}`)}
                  </span>
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{translateZoneName(selectedPost.zone, t)}</p>
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

            {/* Timeline — only for today */}
            {period === 'today' && (
              <PostTimeline
                dashPost={dashData?.posts?.find(p => p.number === selectedPost.number)}
                shiftStart={dashData?.settings?.shiftStart || '08:00'}
                shiftEnd={dashData?.settings?.shiftEnd || '20:00'}
              />
            )}

            {/* Summary cards */}
            <SummaryCards post={selectedPost} t={t} />

            <CollapsibleSection icon={FileText} title={t('postsDetail.workOrders')} count={selectedPost.today.workOrders.length}
              extra={selectedPost.today.workOrders.length > 3 && <button onClick={() => setModal({ type: 'workOrders', data: selectedPost.today.workOrders })} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>{t('postsDetail.showAll')}</button>}
            >
              <WorkOrdersSection workOrders={selectedPost.today.workOrders} t={t} onShowAll={() => setModal({ type: 'workOrders', data: selectedPost.today.workOrders })} />
            </CollapsibleSection>

            <CollapsibleSection icon={Users} title={t('postsDetail.workers')} count={selectedPost.today.workers.length}>
              <WorkersSection workers={selectedPost.today.workers} t={t} onShowAll={() => setModal({ type: 'workers', data: selectedPost.today.workers })} />
            </CollapsibleSection>

            {selectedPost.today.alerts.length > 0 && (
              <CollapsibleSection icon={AlertTriangle} title={t('postsDetail.alerts')} count={selectedPost.today.alerts.length} color="var(--warning)">
                <AlertsSection alerts={selectedPost.today.alerts} t={t} onShowAll={() => setModal({ type: 'alerts', data: selectedPost.today.alerts })} />
              </CollapsibleSection>
            )}

            <CollapsibleSection icon={ScrollText} title={t('postsDetail.eventLog')} count={selectedPost.today.eventLog.length}>
              <EventLogSection events={selectedPost.today.eventLog} t={t} onShowAll={() => setModal({ type: 'events', data: selectedPost.today.eventLog })} />
            </CollapsibleSection>

            <CollapsibleSection icon={BarChart3} title={t('postsDetail.statistics')}>
              <StatsSection stats={selectedPost.today.workStats} t={t} />
            </CollapsibleSection>

            <CollapsibleSection icon={Camera} title={t('postsDetail.cameras')}>
              <CamerasSection cameras={selectedPost.today.cameras} plateImage={selectedPost.today.currentPlateImage} t={t} />
            </CollapsibleSection>

            <CollapsibleSection icon={Calendar} title={t('postsDetail.calendarLoad')}>
              <CalendarSection calendar={selectedPost.calendar} post={selectedPost} t={t} />
            </CollapsibleSection>
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
