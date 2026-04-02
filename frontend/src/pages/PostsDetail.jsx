import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BASE = import.meta.env.BASE_URL || './';
const fetchApi = async (path) => {
  const res = await fetch(`${BASE}data/${path}.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend as RLegend,
} from 'recharts';
import {
  Car, Truck, Wrench, Clock, User, AlertTriangle, ScrollText,
  Camera, Image, ChevronRight, ChevronDown, ArrowLeft, BarChart3, Calendar, FileText,
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
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [calView, setCalView] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  if (!calendar || !calendar.length) return null;

  const calMap = {};
  calendar.forEach(d => { calMap[d.date] = d; });

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekDays = isRu ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = isRu
    ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Build grid for selected month
  const buildGrid = () => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay();
    if (startDow === 0) startDow = 7;
    startDow -= 1;

    const days = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    // Pad to full weeks
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const buildWeekGrid = () => {
    const days = [];
    const now = new Date();
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    for (let i = -dow; i < 7 - dow; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  let grid;
  if (calView === 'week') grid = buildWeekGrid();
  else if (calView === 'custom' && customFrom && customTo) {
    grid = [];
    const from = new Date(customFrom), to = new Date(customTo);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) grid.push(d.toISOString().slice(0, 10));
    // Pad to 7-col
    while (grid.length % 7 !== 0) grid.push(null);
  } else grid = buildGrid();

  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  // Background tint based on avg score
  const cellBg = (day, isFuture) => {
    if (!day || isFuture) return 'transparent';
    const avg = (day.loadPercent + day.efficiency) / 2;
    if (avg >= 75) return 'rgba(34,197,94,0.08)';
    if (avg >= 45) return 'rgba(245,158,11,0.08)';
    return 'rgba(239,68,68,0.08)';
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {[
            { key: 'week', label: isRu ? 'Неделя' : 'Week' },
            { key: 'month', label: isRu ? 'Месяц' : 'Month' },
            { key: 'custom', label: isRu ? 'Период' : 'Custom' },
          ].map(v => (
            <button key={v.key} onClick={() => setCalView(v.key)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all"
              style={{ background: calView === v.key ? 'var(--accent)' : 'var(--bg-glass)', color: calView === v.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${calView === v.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
              {v.label}
            </button>
          ))}
          {calView === 'custom' && (
            <div className="flex items-center gap-1 ml-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-1.5 py-0.5 rounded-lg text-xs" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-1.5 py-0.5 rounded-lg text-xs" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
            </div>
          )}
        </div>
        {/* Month navigation */}
        {calView === 'month' && (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="px-2 py-1 rounded-lg text-xs hover:opacity-80" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>&larr;</button>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', minWidth: 120, textAlign: 'center' }}>
              {monthNames[calMonth.month]} {calMonth.year}
            </span>
            <button onClick={nextMonth} className="px-2 py-1 rounded-lg text-xs hover:opacity-80" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>&rarr;</button>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 text-center" style={{ background: 'var(--bg-glass)' }}>
          {weekDays.map(d => (
            <div key={d} className="py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7" style={{ background: 'var(--border-glass)', gap: 1 }}>
          {grid.map((dateStr, i) => {
            if (!dateStr) return <div key={`e${i}`} style={{ background: 'var(--bg-primary)', minHeight: 90 }} />;
            const day = calMap[dateStr];
            const isFuture = dateStr > todayStr;
            const isToday = dateStr === todayStr;
            const dayNum = new Date(dateStr).getDate();
            const hasData = day && day.loadPercent > 0 && !isFuture;

            return (
              <div key={dateStr}
                className="p-2 transition-all"
                style={{
                  background: isToday ? 'var(--accent-light)' : cellBg(day, isFuture),
                  minHeight: 90,
                  opacity: isFuture ? 0.3 : 1,
                  cursor: hasData ? 'pointer' : 'default',
                }}
                onClick={() => { if (hasData) setSelectedDay(selectedDay === dateStr ? null : dateStr); }}
              >
                {/* Date + WO count */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{dayNum}</span>
                  {hasData && (
                    <div className="flex items-center gap-1">
                      <span style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 600 }}>{day.woCount || 0} {isRu ? 'ЗН' : 'WO'}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{day.normHours}ч</span>
                    </div>
                  )}
                </div>

                {/* Bars with inline % and tooltips */}
                {hasData && (
                  <div className="space-y-1">
                    {[
                      { pct: (day.normHours / (post?.maxCapacityHours || 12)) * 100, color: 'var(--accent)', val: `${day.normHours}ч`, tip: isRu ? `План: ${day.normHours}ч` : `Plan: ${day.normHours}h` },
                      { pct: ((day.normHours - (day.idleHours || 0) * 0.5) / (post?.maxCapacityHours || 12)) * 100, color: 'var(--success)', val: `${Math.round((day.normHours - (day.idleHours || 0) * 0.5) * 10) / 10}ч`, tip: isRu ? `Факт: ${Math.round((day.normHours - (day.idleHours || 0) * 0.5) * 10) / 10}ч` : `Fact: ${Math.round((day.normHours - (day.idleHours || 0) * 0.5) * 10) / 10}h` },
                      { pct: day.loadPercent, color: loadColor(day.loadPercent), val: day.loadPercent, tip: isRu ? `Загрузка: ${day.loadPercent}%` : `Load: ${day.loadPercent}%` },
                      { pct: day.efficiency, color: effColor(day.efficiency), val: day.efficiency, tip: isRu ? `Эффективность: ${day.efficiency}%` : `Efficiency: ${day.efficiency}%` },
                    ].map((bar, bi) => (
                      <div key={bi} className="flex items-center gap-1 relative group">
                        <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--border-glass)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(bar.pct, 100)}%`, background: bar.color }} />
                        </div>
                        <span style={{ fontSize: '8px', color: bar.color, fontWeight: 700, minWidth: 18, textAlign: 'right' }}>{bar.val}</span>
                        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                          style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', fontSize: '10px', whiteSpace: 'nowrap' }}>
                          {bar.tip}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && calMap[selectedDay] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedDay(null)}>
          <div className="glass rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl" style={{ border: '1px solid var(--border-glass)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {new Date(selectedDay).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            {(() => {
              const day = calMap[selectedDay];
              return (
                <div className="space-y-3">
                  {/* Top metrics grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: `${day.loadPercent}%`, label: t('postsDetail.load'), color: loadColor(day.loadPercent) },
                      { val: `${day.efficiency}%`, label: t('postsDetail.efficiency'), color: effColor(day.efficiency) },
                      { val: `${day.woCount || 0}`, label: isRu ? 'Заказ-наряды' : 'Work Orders', color: 'var(--accent)' },
                    ].map((m, idx) => (
                      <div key={idx} className="text-center p-2.5 rounded-xl" style={{ background: 'var(--bg-glass)' }}>
                        <div className="text-xl font-bold" style={{ color: m.color }}>{m.val}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detailed metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: isRu ? 'Нормо-часы' : 'Norm hours', val: `${day.normHours}ч`, color: 'var(--text-primary)' },
                      { label: isRu ? 'Простой' : 'Idle', val: `${day.idleHours || 0}ч`, color: (day.idleHours || 0) > 4 ? 'var(--danger)' : 'var(--text-muted)' },
                      { label: isRu ? 'Макс. ёмкость' : 'Max capacity', val: `${post?.maxCapacityHours || 12}ч`, color: 'var(--text-muted)' },
                      { label: isRu ? 'Турбо' : 'Turbo', val: `${day.turboHours || 0}ч`, color: 'var(--success)' },
                    ].map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                        <span className="text-sm font-bold" style={{ color: m.color }}>{m.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-2">
                    {[
                      { label: t('postsDetail.load'), pct: day.loadPercent, color: loadColor(day.loadPercent) },
                      { label: t('postsDetail.efficiency'), pct: day.efficiency, color: effColor(day.efficiency) },
                    ].map((bar, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: 'var(--text-muted)' }}>{bar.label}</span>
                          <span className="font-bold" style={{ color: bar.color }}>{bar.pct}%</span>
                        </div>
                        <div className="h-3 rounded-full" style={{ background: 'var(--border-glass)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${bar.pct}%`, background: bar.color }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Plan vs Fact bar */}
                  <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)' }}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'План / Факт' : 'Plan / Fact'}</span>
                    </div>
                    <div className="flex gap-1 h-2.5">
                      <div className="rounded-full" style={{ width: `${(day.normHours / (post?.maxCapacityHours || 12)) * 100}%`, background: 'var(--accent)' }} />
                      <div className="rounded-full" style={{ width: `${((day.normHours - (day.idleHours || 0)) / (post?.maxCapacityHours || 12)) * 100}%`, background: 'var(--success)' }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{isRu ? 'План' : 'Plan'}: {day.normHours}ч</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{isRu ? 'Факт' : 'Fact'}: {Math.round((day.normHours - (day.idleHours || 0) * 0.5) * 10) / 10}ч</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
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
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [modal, setModal] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/posts-detail')}
                  className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {translatePostName(selectedPost.name, t)}
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {t(`posts.${selectedPost.type}`)}
                  </span>
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{translateZoneName(selectedPost.zone, t)}</p>
                </div>
              </div>
              {/* Period selector */}
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'today', label: t('postsDetail.today') },
                  { key: 'yesterday', label: t('postsDetail.yesterday') },
                  { key: 'week', label: t('postsDetail.week') },
                  { key: 'month', label: t('postsDetail.month') },
                  { key: 'custom', label: isRu ? 'Период' : 'Custom' },
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); if (p.key === 'custom') setShowCustom(true); else setShowCustom(false); }}
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
                {showCustom && (
                  <div className="flex items-center gap-1 ml-1">
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      className="px-1.5 py-0.5 rounded-lg text-xs"
                      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                      className="px-1.5 py-0.5 rounded-lg text-xs"
                      style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                  </div>
                )}
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
          <div>
            {/* Header with period + view toggle */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('postsDetail.title')}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Period selector */}
                <div className="flex items-center gap-1">
                  {[
                    { key: 'today', label: t('postsDetail.today') },
                    { key: 'yesterday', label: t('postsDetail.yesterday') },
                    { key: 'week', label: t('postsDetail.week') },
                    { key: 'month', label: t('postsDetail.month') },
                    { key: 'custom', label: isRu ? 'Период' : 'Custom' },
                  ].map(p => (
                    <button key={p.key}
                      onClick={() => { setPeriod(p.key); if (p.key === 'custom') setShowCustom(true); else setShowCustom(false); }}
                      className="px-2 py-1 rounded-lg text-xs transition-all"
                      style={{ background: period === p.key ? 'var(--accent)' : 'var(--bg-glass)', color: period === p.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${period === p.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
                      {p.label}
                    </button>
                  ))}
                  {showCustom && (
                    <div className="flex items-center gap-1 ml-1">
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg text-xs"
                        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="px-1.5 py-0.5 rounded-lg text-xs"
                        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }} />
                    </div>
                  )}
                </div>
                {/* View toggle */}
                <div className="flex gap-1" style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: 8 }}>
                  {[{ key: 'cards', label: isRu ? 'Плитки' : 'Cards' }, { key: 'table', label: isRu ? 'Таблица' : 'Table' }].map(v => (
                    <button key={v.key} onClick={() => setViewMode(v.key)}
                      className="px-3 py-1 rounded-lg text-xs transition-all"
                      style={{ background: viewMode === v.key ? 'var(--accent)' : 'var(--bg-glass)', color: viewMode === v.key ? '#fff' : 'var(--text-secondary)', border: `1px solid ${viewMode === v.key ? 'var(--accent)' : 'var(--border-glass)'}` }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* === VARIANT A: Cards === */}
            {viewMode === 'cards' && (
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
                      onClick={() => navigate(`/posts-detail?post=${post.id}`)}>
                      {/* Card header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.loadPercent > 50 ? 'var(--success)' : d.loadPercent > 0 ? 'var(--warning)' : 'var(--text-muted)' }} />
                          <Icon size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{translatePostName(post.name, t)}</span>
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
                        <div className="flex-1 relative group">
                          <div style={{ color: 'var(--text-muted)', fontSize: '9px', marginBottom: 2 }}>{isRu ? 'Исполнители' : 'Workers'}</div>
                          {topWorkers.map((w, i) => <div key={i} className="truncate">{w.name}</div>)}
                          {!topWorkers.length && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          <div className="absolute top-full left-0 mt-1 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                            style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 160, fontSize: '11px', textAlign: 'center' }}>
                            {isRu ? 'ТОП-3 исполнителей на посту' : 'Top 3 workers on post'}
                          </div>
                        </div>
                        <div className="flex-1 relative group">
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
            )}

            {/* === VARIANT B: Table with inline bars === */}
            {viewMode === 'table' && (
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
                            onClick={() => navigate(`/posts-detail?post=${post.id}`)}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: d.loadPercent > 50 ? 'var(--success)' : d.loadPercent > 0 ? 'var(--warning)' : 'var(--text-muted)' }} />
                                <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
                                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{translatePostName(post.name, t)}</span>
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
            )}
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
