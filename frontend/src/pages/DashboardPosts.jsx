import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, AlertTriangle, Settings, Save, Check,
  CircleDot, Timer, FileText, Calendar, ArrowRight, Car,
  MapPin, HelpCircle, CheckCircle2, Square, Zap, Wrench,
} from 'lucide-react';
import { getShiftBounds, percentToTime, detectConflicts } from '../components/dashboardPosts/constants';
import { POST_STATUS_COLORS } from '../constants';

// hex → rgba для цветных подложек KPI-плиток
function hexA(hex, a) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
import GanttTimeline from '../components/dashboardPosts/GanttTimeline';
import ShiftSettings, { getTodayShift } from '../components/dashboardPosts/ShiftSettings';
import WorkOrderModal from '../components/dashboardPosts/WorkOrderModal';
import FreeWorkOrdersTable from '../components/dashboardPosts/FreeWorkOrdersTable';
import Legend from '../components/dashboardPosts/Legend';
import ConflictModal from '../components/dashboardPosts/ConflictModal';
import HelpButton from '../components/HelpButton';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';

// fetchShifts will be set after component mounts using api from AuthContext

// Main component
export default function DashboardPosts() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api, appMode, isElementVisible } = useAuth();
  const isLive = appMode === 'live';
  const elVis = (id) => isElementVisible('dashboard-posts', id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [dataConflicts, setDataConflicts] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [settings, setSettings] = useState({
    shiftStart: '08:00',
    shiftEnd: '22:00',
    postsCount: 10,
  });

  // Load settings from backend
  useEffect(() => {
    api.get('/api/settings')
      .then(({ data: s }) => {
        if (s.weekSchedule || s.shiftStart) {
          setSettings(prev => ({ ...prev, ...s }));
        }
      })
      .catch(() => {});
  }, []);

  // Load current shift
  useEffect(() => {
    api.get('/api/shifts')
      .then(res => {
        const d = res.data || res;
        const today = new Date().toISOString().split('T')[0];
        const active = (d.shifts || []).find(s => (s.date || '').slice(0, 10) === today && s.status === 'active');
        if (active) setCurrentShift(active);
        else {
          const todayShift = (d.shifts || []).find(s => (s.date || '').slice(0, 10) === today);
          if (todayShift) setCurrentShift(todayShift);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/api/dashboard-posts')
      .then(({ data: res }) => {
        setData(res);
        if (res.settings) {
          setSettings(prev => ({ ...prev, ...res.settings }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { fetchData(); }, []);

  // Multi-user sync via polling (schedule:updated)
  useEffect(() => {
    const handler = () => { fetchData(); };
    // If socket available, listen for schedule updates
    try {
      const socket = window.__metricsSocket;
      if (socket) {
        socket.on('schedule:updated', handler);
        return () => socket.off('schedule:updated', handler);
      }
    } catch {}
  }, [fetchData]);

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    api.put('/api/settings', {
      weekSchedule: newSettings.weekSchedule,
      postsCount: newSettings.postsCount,
      shiftStart: newSettings.shiftStart,
      shiftEnd: newSettings.shiftEnd,
      timezone: newSettings.timezone,
    }).catch(() => {});
  };

  const todayShift = useMemo(() => getTodayShift(settings), [settings]);

  const handleBlockClick = (item, post) => {
    setSelectedItem(item);
    setSelectedPost(post);
  };

  const posts = useMemo(() => {
    if (!data?.posts) return [];
    // Не режем по postsCount: API уже отдаёт активные посты + зоны.
    return data.posts;
  }, [data]);

  // Conflict detection — только посты, у зон таймлайна нет
  const conflicts = useMemo(() => detectConflicts(posts.filter(p => p.kind !== 'zone')), [posts]);
  const conflictItemIds = useMemo(() => {
    const set = new Set();
    conflicts.forEach(c => c.items.forEach(id => set.add(id)));
    return set;
  }, [conflicts]);

  // Handle drop from timeline block or free work order
  const handleDrop = useCallback((dropData) => {
    if (!data) return;

    const { type, itemId, fromPostId, toPostId, dropPercent } = dropData;
    const newStartMs = percentToTime(dropPercent, todayShift.shiftStart, todayShift.shiftEnd);

    // Save snapshot for rollback on conflict
    setSnapshot(JSON.parse(JSON.stringify(data)));

    setData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const targetPost = newData.posts.find(p => p.id === toPostId);
      if (!targetPost) return prev;

      if (type === 'timeline-block') {
        // Moving an existing block
        const sourcePost = newData.posts.find(p => p.id === fromPostId);
        if (!sourcePost) return prev;

        const itemIndex = sourcePost.timeline.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return prev;

        const item = sourcePost.timeline[itemIndex];
        const startMs = new Date(item.startTime).getTime();
        const endMs = new Date(item.endTime || item.estimatedEnd || item.startTime).getTime();
        const durationMs = endMs - startMs;

        const newStart = new Date(newStartMs);
        const newEnd = new Date(newStartMs + durationMs);

        // Update item times
        item.startTime = newStart.toISOString();
        if (item.endTime) {
          item.endTime = newEnd.toISOString();
        }
        if (item.estimatedEnd) {
          item.estimatedEnd = newEnd.toISOString();
        }

        // Move between posts if needed
        if (fromPostId !== toPostId) {
          sourcePost.timeline.splice(itemIndex, 1);
          targetPost.timeline.push(item);
        }

        // Record pending change
        setPendingChanges(prev => {
          const existing = prev.findIndex(c => c.workOrderId === item.workOrderId);
          const change = {
            workOrderId: item.workOrderId || itemId,
            itemId,
            postId: toPostId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = change;
            return updated;
          }
          return [...prev, change];
        });

      } else if (type === 'free-work-order') {
        // Assign a free work order to a post
        const durationMs = (dropData.normHours || 1) * 60 * 60 * 1000;
        const newStart = new Date(newStartMs);
        const newEnd = new Date(newStartMs + durationMs);

        const newTimelineItem = {
          id: `tl-dnd-${itemId}`,
          workOrderNumber: dropData.workOrderNumber,
          workOrderId: itemId,
          plateNumber: dropData.plateNumber,
          brand: dropData.brand,
          model: dropData.model,
          workType: dropData.workType,
          status: 'scheduled',
          startTime: newStart.toISOString(),
          endTime: null,
          normHours: dropData.normHours,
          master: null,
          worker: null,
          estimatedEnd: newEnd.toISOString(),
        };

        targetPost.timeline.push(newTimelineItem);

        // Remove from freeWorkOrders
        newData.freeWorkOrders = (newData.freeWorkOrders || []).filter(wo => wo.id !== itemId);

        // Record pending change
        setPendingChanges(prev => [...prev, {
          workOrderId: itemId,
          itemId: newTimelineItem.id,
          postId: toPostId,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          isNew: true,
        }]);
      }

      return newData;
    });
  }, [data, todayShift.shiftStart, todayShift.shiftEnd]);

  // Save schedule
  const handleSave = useCallback(async (forceOverwrite = false) => {
    if (pendingChanges.length === 0) return;
    setSaveStatus('saving');

    try {
      // Build assignments, include version for conflict detection
      const assignments = pendingChanges.map(c => {
        const assignment = {
          workOrderId: c.workOrderId,
          postId: c.postId,
          startTime: c.startTime,
          endTime: c.endTime,
        };
        // Include version unless forcing overwrite
        if (!forceOverwrite && c.version !== undefined) {
          assignment.version = c.version;
        }
        return assignment;
      });
      await api.post('/api/work-orders/schedule', { assignments });
      setPendingChanges([]);
      setSnapshot(null);
      setSaveStatus('saved');
    } catch (err) {
      // Handle 409 conflict
      if (err?.response?.status === 409 && err?.response?.data?.conflicts) {
        // Rollback to snapshot
        if (snapshot) {
          setData(snapshot);
        }
        setDataConflicts(err.response.data.conflicts);
        setSaveStatus('error');
        return;
      }
      setSaveStatus('error');
    }

    // Reset status after 2s
    setTimeout(() => setSaveStatus(null), 2000);
  }, [pendingChanges, api, data, snapshot]);

  // Summary stats — счётчики по постам и зонам считаем отдельно
  const stats = useMemo(() => {
    if (!posts.length) return {};
    const onlyPosts = posts.filter(p => p.kind !== 'zone');
    const onlyZones = posts.filter(p => p.kind === 'zone');
    const occupied = onlyPosts.filter(p => p.status !== 'free' && p.status !== 'no_data').length;
    const free = onlyPosts.filter(p => p.status === 'free').length;
    const noData = onlyPosts.filter(p => p.status === 'no_data').length;
    const zonesOccupied = onlyZones.filter(z => z.status !== 'free' && z.status !== 'no_data').length;
    const zonesFree = onlyZones.filter(z => z.status === 'free').length;
    let completedWO = 0, totalNormHours = 0, totalActualHours = 0;
    let idleMinutes = 0, overdueMinutes = 0, savedMinutes = 0;
    const now = new Date();
    const { start: shiftStartMs } = getShiftBounds(todayShift.shiftStart, todayShift.shiftEnd);

    onlyPosts.forEach(p => {
      const tl = p.timeline.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      tl.forEach(item => {
        if (item.status === 'completed') {
          completedWO++;
          totalNormHours += item.normHours || 0;
          totalActualHours += item.actualHours || 0;
          if (item.actualHours != null && item.normHours > item.actualHours) {
            savedMinutes += (item.normHours - item.actualHours) * 60;
          }
        }
        if (item.status === 'in_progress' && item.estimatedEnd) {
          const est = new Date(item.estimatedEnd);
          if (now > est) overdueMinutes += (now - est) / 60000;
        }
      });
      for (let i = 0; i < tl.length - 1; i++) {
        const end = new Date(tl[i].endTime || tl[i].estimatedEnd || tl[i].startTime);
        const nextStart = new Date(tl[i + 1].startTime);
        if (nextStart > end) idleMinutes += (nextStart - end) / 60000;
      }
      if (tl.length > 0) {
        const firstStart = new Date(tl[0].startTime);
        if (firstStart.getTime() > shiftStartMs) {
          idleMinutes += (firstStart.getTime() - shiftStartMs) / 60000;
        }
      }
    });

    const fmtMin = (m) => {
      const h = Math.floor(m / 60);
      const min = Math.round(m % 60);
      return h > 0 ? `${h}\u0447 ${min}\u043c` : `${min}\u043c`;
    };

    // Завершённые визиты CV — закрытые блоки (visitClosed=true), либо fallback по статусу
    // 'completed' для совместимости с demo-режимом, где timeline = ЗН.
    const completedVisits = onlyPosts.reduce((s, p) =>
      s + (p.timeline || []).filter(t => t.visitClosed === true || t.status === 'completed').length, 0);

    // В live-режиме timeline = визиты CV (≠ ЗН). Реальные ЗН (1С → WorkOrder в БД)
    // приходят отдельным полем data.workOrdersStats. Используем его для счётчиков ЗН.
    const woStats = data?.workOrdersStats;
    if (woStats) {
      return {
        occupied, free, noData,
        zonesOccupied, zonesFree,
        completedWO: woStats.completed || 0,
        completedVisits,
        totalNormHours: Math.round((woStats.totalNormHours || 0) * 10) / 10,
        idleTime: fmtMin(idleMinutes),
        overdueTime: fmtMin(overdueMinutes),
        savedTime: fmtMin(woStats.savedMinutes || 0),
      };
    }

    return { occupied, free, noData, zonesOccupied, zonesFree, completedWO, completedVisits, totalNormHours: Math.round(totalNormHours * 10) / 10, idleTime: fmtMin(idleMinutes), overdueTime: fmtMin(overdueMinutes), savedTime: fmtMin(savedMinutes) };
  }, [posts, todayShift.shiftStart, todayShift.shiftEnd, data?.workOrdersStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            {t('dashboardPosts.title')}
            <HelpButton pageKey="dashboardPosts" />
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('dashboardPosts.subtitle')} · {todayShift.shiftStart} – {todayShift.shiftEnd}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Save button — only visible when there are pending changes */}
          {pendingChanges.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{
                background: saveStatus === 'saved' ? 'var(--success)' : 'var(--accent)',
                color: '#fff',
                opacity: saveStatus === 'saving' ? 0.7 : 1,
              }}
            >
              {saveStatus === 'saved' ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              {saveStatus === 'saving'
                ? (isRu ? 'Сохранение...' : 'Saving...')
                : saveStatus === 'saved'
                  ? t('dashboardPosts.saved')
                  : `${t('dashboardPosts.saveSchedule')} (${pendingChanges.length})`
              }
            </button>
          )}

          {/* Conflict indicator */}
          {conflicts.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
            >
              <AlertTriangle size={13} />
              {t('dashboardPosts.conflict')} ({conflicts.length})
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {new Date().toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Current Shift Indicator */}
      {elVis('currentShift') && currentShift && (
        <Link
          to="/shifts"
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:opacity-90 transition-opacity"
          style={{
            background: currentShift.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-glass)',
            border: `1px solid ${currentShift.status === 'active' ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-glass)'}`,
          }}
        >
          <Clock size={14} style={{ color: currentShift.status === 'active' ? 'var(--success)' : 'var(--accent)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('shifts.currentShift')}: {currentShift.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {currentShift.startTime} - {currentShift.endTime}
          </span>
          <div className="flex items-center gap-1">
            <Users size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {currentShift.workers?.length || 0}
            </span>
          </div>
          <ArrowRight size={12} style={{ color: 'var(--accent)' }} />
        </Link>
      )}

      {/* Summary stats — единая палитра карты СТО:
          occupied (Занято)=оранжевый, free (Свободно)=зелёный,
          no_data=серый, completed=зелёный, overdue=красный, turbo=индиго. */}
      {elVis('headerStats') && <div className="flex flex-wrap gap-2">
        {[
          { label: isRu ? 'Постов занято' : 'Posts occupied', value: stats.occupied, color: POST_STATUS_COLORS.occupied, icon: Square, tinted: true,
            tip: isRu ? 'Количество постов, на которых сейчас находится автомобиль' : 'Number of posts currently occupied by a vehicle' },
          { label: isRu ? 'Постов свободно' : 'Posts free', value: stats.free, color: POST_STATUS_COLORS.free, icon: CheckCircle2, tinted: true,
            tip: isRu ? 'Количество свободных постов, готовых принять авто' : 'Number of free posts ready to accept a vehicle' },
          ...(stats.noData > 0 ? [{ label: isRu ? 'Нет данных' : 'No data', value: stats.noData, color: POST_STATUS_COLORS.no_data, icon: HelpCircle, tinted: true,
            tip: isRu ? 'Посты, по которым CV-система не передаёт данные' : 'Posts with no data from the CV system' }] : []),
          { sep: true },
          { label: isRu ? 'Зон занято' : 'Zones occupied', value: stats.zonesOccupied, color: POST_STATUS_COLORS.occupied, icon: MapPin, tinted: true,
            tip: isRu ? 'Количество свободных зон ожидания/парковки, в которых сейчас стоит авто' : 'Number of waiting/parking zones currently occupied' },
          { label: isRu ? 'Зон свободно' : 'Zones free', value: stats.zonesFree, color: POST_STATUS_COLORS.free, icon: MapPin, tinted: true,
            tip: isRu ? 'Количество свободных зон ожидания/парковки' : 'Number of free waiting/parking zones' },
          { sep: true },
          { label: isRu ? 'Выполнено ЗН' : 'Completed WO', value: stats.completedWO, color: POST_STATUS_COLORS.free, icon: FileText, tinted: true,
            tip: isRu ? 'Количество завершённых заказ-нарядов (из 1С) за текущую смену' : 'Number of completed work orders (from 1C) this shift' },
          ...(isLive ? [{ label: isRu ? 'Завершено визитов' : 'Completed visits', value: stats.completedVisits, color: POST_STATUS_COLORS.active_work, icon: Car, tinted: true,
            tip: isRu ? 'Количество закрытых визитов по данным CV-системы (авто приехало → уехало). Не путать с ЗН — это разные сущности' : 'Number of closed visits per CV system (vehicle arrived → left). Not the same as work orders' }] : []),
          { label: isRu ? 'Нормо-часы' : 'Norm hours', value: stats.totalNormHours, color: 'var(--text-primary)', icon: Clock,
            tip: isRu ? 'Сумма нормо-часов по завершённым заказ-нарядам' : 'Total norm hours from completed work orders' },
          { label: isRu ? 'Простой' : 'Idle time', value: stats.idleTime, color: POST_STATUS_COLORS.occupied_no_work, icon: Timer, tinted: true,
            tip: isRu ? 'Суммарное время, когда посты были свободны в течение смены' : 'Total time posts were idle during the shift' },
          // «Просрочка» считается из estimatedEnd ЗН. В live-режиме у визитов нет
          // estimatedEnd → всегда 0м, поэтому скрываем.
          ...(isLive ? [] : [{ label: isRu ? 'Просрочка' : 'Overdue', value: stats.overdueTime, color: POST_STATUS_COLORS.occupied_no_work, icon: AlertTriangle, tinted: true,
            tip: isRu ? 'Суммарное время задержки — работы идут дольше запланированного' : 'Total overdue time — work taking longer than planned' }]),
          { label: isRu ? 'Турбо' : 'Turbo', value: stats.savedTime, color: POST_STATUS_COLORS.free, icon: Zap, tinted: true,
            tip: isRu ? 'Сэкономленное время — работы выполнены быстрее нормо-часов' : 'Saved time — work completed faster than norm hours' },
        ].map((card, i) => card.sep ? (
          <div key={i} style={{ width: 1, background: 'var(--border-glass)', alignSelf: 'stretch', margin: '0 4px' }} />
        ) : (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg relative group transition-all hover:translate-y-[-1px]"
            style={card.tinted && card.color?.startsWith('#') ? {
              background: hexA(card.color, 0.10),
              border: `1px solid ${hexA(card.color, 0.28)}`,
            } : {
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <div className="absolute top-full left-0 mt-1 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 220, fontSize: '12px', lineHeight: 1.4 }}>
              {card.tip}
            </div>
            <card.icon size={12} strokeWidth={2.5} style={{ color: card.color, flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
            <span className="text-sm font-bold" style={{ color: card.color }}>{card.value}</span>
          </div>
        ))}
      </div>}

      {/* Legend */}
      <Legend t={t} isLive={isLive} />

      {/* Gantt Timeline */}
      {elVis('ganttTimeline') && <GanttTimeline
        posts={posts}
        shiftStart={todayShift.shiftStart}
        shiftEnd={todayShift.shiftEnd}
        onBlockClick={handleBlockClick}
        onDrop={handleDrop}
        conflictItemIds={conflictItemIds}
      />}

      {/* Free work orders */}
      {elVis('freeOrders') && <FreeWorkOrdersTable orders={data?.freeWorkOrders} t={t} />}

      {/* Modals */}
      {selectedItem && (
        <WorkOrderModal
          item={selectedItem}
          post={selectedPost}
          onClose={() => { setSelectedItem(null); setSelectedPost(null); }}
          t={t}
        />
      )}

      {showSettings && (
        <ShiftSettings
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
          t={t}
        />
      )}

      {dataConflicts && (
        <ConflictModal
          conflicts={dataConflicts}
          onReload={() => { fetchData(); setDataConflicts(null); setPendingChanges([]); }}
          onForce={() => { setDataConflicts(null); handleSave(true); }}
          onClose={() => setDataConflicts(null)}
        />
      )}
    </div>
  );
}
