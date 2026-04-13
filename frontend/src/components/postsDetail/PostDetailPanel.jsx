import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  Car, Truck, Wrench, Clock, User, AlertTriangle, ScrollText,
  Camera, Image, ChevronRight, ChevronDown, ArrowLeft, BarChart3, Calendar, FileText,
  CircleDot, Timer, X, Users, Activity, Eye,
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

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

function translatePostName(name, t) {
  const num = name?.match(/\d+/)?.[0];
  if (num) return t(`posts.post${num}`);
  return name;
}

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

// --- Sub-sections ---

function SummaryCards({ post, t }) {
  const d = post.today;
  const maxH = post.maxCapacityHours;
  return (
    <div className="flex gap-3 mb-4">
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
      <div className="flex flex-col gap-2" style={{ minWidth: 180 }}>
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

function WorkOrdersSection({ workOrders }) {
  const visible = workOrders.slice(0, 5);
  return (
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
  );
}

function WorkersSection({ workers }) {
  if (!workers.length) return null;
  return (
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
  );
}

function AlertsSection({ alerts }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-1.5">
      {alerts.map(a => (
        <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-glass)', border: `1px solid ${SEVERITY_COLORS[a.severity] || 'var(--border-glass)'}` }}>
          <AlertTriangle size={12} style={{ color: SEVERITY_COLORS[a.severity] || 'var(--warning)' }} />
          <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{a.message}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(a.time)}</span>
        </div>
      ))}
    </div>
  );
}

function EventLogSection({ events }) {
  if (!events.length) return null;
  const visible = events.slice(0, 5);
  return (
    <div className="space-y-1">
      {visible.map(ev => (
        <div key={ev.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:opacity-80" style={{ background: 'var(--bg-glass)' }}>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(ev.time)}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.description}</span>
        </div>
      ))}
    </div>
  );
}

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
    while (grid.length % 7 !== 0) grid.push(null);
  } else grid = buildGrid();

  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

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

      {/* Calendar grid */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="grid grid-cols-7 text-center" style={{ background: 'var(--bg-glass)' }}>
          {weekDays.map(d => (
            <div key={d} className="py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ background: 'var(--border-glass)', gap: 1 }}>
          {grid.map((dateStr, i) => {
            if (!dateStr) return <div key={`e${i}`} style={{ background: 'var(--bg-primary)', minHeight: 90 }} />;
            const day = calMap[dateStr];
            const isFuture = dateStr > todayStr;
            const isToday = dateStr === todayStr;
            const dayNum = new Date(dateStr).getDate();
            const hasData = day && day.loadPercent > 0 && !isFuture;
            return (
              <div key={dateStr} className="p-2 transition-all"
                style={{ background: isToday ? 'var(--accent-light)' : cellBg(day, isFuture), minHeight: 90, opacity: isFuture ? 0.3 : 1, cursor: hasData ? 'pointer' : 'default' }}
                onClick={() => { if (hasData) setSelectedDay(selectedDay === dateStr ? null : dateStr); }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{dayNum}</span>
                  {hasData && (
                    <div className="flex items-center gap-1">
                      <span style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 600 }}>{day.woCount || 0} {isRu ? 'ЗН' : 'WO'}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{day.normHours}ч</span>
                    </div>
                  )}
                </div>
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

// Timeline for selected post
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
  const ticks = [];
  for (let h = startH; h <= endH; h++) {
    ticks.push({ h, m: 0, isHour: true });
    if (h < endH) ticks.push({ h, m: 30, isHour: false });
  }
  return (
    <div className="glass rounded-xl p-3 mb-4" style={{ border: '1px solid var(--border-glass)' }}>
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
      <div className="relative rounded" style={{ height: 32, background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
        {ticks.map(({ h, m, isHour }) => {
          const pos = ((h - startH + m / 60) / total) * 100;
          return (
            <div key={`g${h}:${m}`} className="absolute top-0 bottom-0" style={{
              left: `${pos}%`, width: 1,
              background: 'var(--text-muted)', opacity: isHour ? 0.3 : 0.12,
            }} />
          );
        })}
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
              title={`${item.workOrderNumber} — ${item.workType}`}>
              <span className="font-medium truncate" style={{ fontSize: '9px' }}>{item.workOrderNumber}</span>
            </div>
          );
        })}
        <div className="absolute top-0 bottom-0" style={{ left: `${nowPos}%`, width: 2, background: 'var(--danger)', zIndex: 3 }}>
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
        </div>
      </div>
    </div>
  );
}

// --- Main PostDetailPanel ---

export default function PostDetailPanel({ selectedPost, dashData, period, setPeriod, showCustom, setShowCustom, customFrom, setCustomFrom, customTo, setCustomTo, navigate, setModal }) {
  const { t, i18n } = useTranslation();
  const { isElementVisible } = useAuth();
  const elVis = (id) => isElementVisible('posts-detail', id);
  const isRu = i18n.language === 'ru';

  return (
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

      {/* Timeline */}
      {elVis('pd.timeline') && period === 'today' && (
        <PostTimeline
          dashPost={dashData?.posts?.find(p => p.number === selectedPost.number)}
          shiftStart={dashData?.settings?.shiftStart || '08:00'}
          shiftEnd={dashData?.settings?.shiftEnd || '20:00'}
        />
      )}

      {/* Summary cards */}
      {elVis('pd.summary') && <SummaryCards post={selectedPost} t={t} />}

      {elVis('pd.workOrders') && (
        <CollapsibleSection icon={FileText} title={t('postsDetail.workOrders')} count={selectedPost.today.workOrders.length}
          extra={selectedPost.today.workOrders.length > 3 && <button onClick={() => setModal({ type: 'workOrders', data: selectedPost.today.workOrders })} className="text-xs hover:opacity-80" style={{ color: 'var(--accent)' }}>{t('postsDetail.showAll')}</button>}
        >
          <WorkOrdersSection workOrders={selectedPost.today.workOrders} />
        </CollapsibleSection>
      )}

      {elVis('pd.workers') && (
        <CollapsibleSection icon={Users} title={t('postsDetail.workers')} count={selectedPost.today.workers.length}>
          <WorkersSection workers={selectedPost.today.workers} />
        </CollapsibleSection>
      )}

      {elVis('pd.alerts') && selectedPost.today.alerts.length > 0 && (
        <CollapsibleSection icon={AlertTriangle} title={t('postsDetail.alerts')} count={selectedPost.today.alerts.length} color="var(--warning)">
          <AlertsSection alerts={selectedPost.today.alerts} />
        </CollapsibleSection>
      )}

      {elVis('pd.eventLog') && (
        <CollapsibleSection icon={ScrollText} title={t('postsDetail.eventLog')} count={selectedPost.today.eventLog.length}>
          <EventLogSection events={selectedPost.today.eventLog} />
        </CollapsibleSection>
      )}

      {elVis('pd.statistics') && (
        <CollapsibleSection icon={BarChart3} title={t('postsDetail.statistics')}>
          <StatsSection stats={selectedPost.today.workStats} t={t} />
        </CollapsibleSection>
      )}

      {elVis('pd.cameras') && (
        <CollapsibleSection icon={Camera} title={t('postsDetail.cameras')}>
          <CamerasSection cameras={selectedPost.today.cameras} plateImage={selectedPost.today.currentPlateImage} t={t} />
        </CollapsibleSection>
      )}

      {elVis('pd.calendar') && (
        <CollapsibleSection icon={Calendar} title={t('postsDetail.calendarLoad')}>
          <CalendarSection calendar={selectedPost.calendar} post={selectedPost} t={t} />
        </CollapsibleSection>
      )}
    </>
  );
}
