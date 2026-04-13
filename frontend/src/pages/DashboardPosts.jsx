import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock, AlertTriangle, Settings, Save, Check,
  CircleDot, Timer, FileText, Calendar, ArrowRight,
} from 'lucide-react';
import { getShiftBounds, percentToTime, detectConflicts } from '../components/dashboardPosts/constants';
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
  const { api, appMode } = useAuth();
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
    shiftEnd: '20:00',
    postsCount: 10,
  });

  useEffect(() => {
    const saved = localStorage.getItem('dashboardPostsSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) { /* ignore */ }
    }
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
          const saved = localStorage.getItem('dashboardPostsSettings');
          if (!saved) {
            setSettings(res.settings);
          }
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
    localStorage.setItem('dashboardPostsSettings', JSON.stringify(newSettings));
  };

  const todayShift = useMemo(() => getTodayShift(settings), [settings]);

  const handleBlockClick = (item, post) => {
    setSelectedItem(item);
    setSelectedPost(post);
  };

  const posts = useMemo(() => {
    if (!data?.posts) return [];
    return data.posts.slice(0, settings.postsCount);
  }, [data, settings.postsCount]);

  // Conflict detection
  const conflicts = useMemo(() => detectConflicts(posts), [posts]);
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
      // Backend not running — save to localStorage as fallback
      try {
        localStorage.setItem('dashboardPostsSchedule', JSON.stringify({
          changes: pendingChanges,
          savedAt: new Date().toISOString(),
          posts: data?.posts,
          freeWorkOrders: data?.freeWorkOrders,
        }));
        setPendingChanges([]);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }

    // Reset status after 2s
    setTimeout(() => setSaveStatus(null), 2000);
  }, [pendingChanges, api, data, snapshot]);

  // Summary stats
  const stats = useMemo(() => {
    if (!posts.length) return {};
    const occupied = posts.filter(p => p.status !== 'free').length;
    const free = posts.length - occupied;
    let completedWO = 0, totalNormHours = 0, totalActualHours = 0;
    let idleMinutes = 0, overdueMinutes = 0, savedMinutes = 0;
    const now = new Date();
    const { start: shiftStartMs } = getShiftBounds(todayShift.shiftStart, todayShift.shiftEnd);

    posts.forEach(p => {
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

    return { occupied, free, completedWO, totalNormHours: Math.round(totalNormHours * 10) / 10, idleTime: fmtMin(idleMinutes), overdueTime: fmtMin(overdueMinutes), savedTime: fmtMin(savedMinutes) };
  }, [posts, todayShift.shiftStart, todayShift.shiftEnd]);

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
      {currentShift && (
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

      {/* Summary stats */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: isRu ? '\u0417\u0430\u043d\u044f\u0442\u043e' : 'Occupied', value: stats.occupied, color: 'var(--accent)', icon: CircleDot,
            tip: isRu ? '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u043f\u043e\u0441\u0442\u043e\u0432, \u043d\u0430 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0430\u0445\u043e\u0434\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c' : 'Number of posts currently occupied by a vehicle' },
          { label: isRu ? '\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u043e' : 'Free', value: stats.free, color: 'var(--warning)', icon: CircleDot,
            tip: isRu ? '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0445 \u043f\u043e\u0441\u0442\u043e\u0432, \u0433\u043e\u0442\u043e\u0432\u044b\u0445 \u043f\u0440\u0438\u043d\u044f\u0442\u044c \u0430\u0432\u0442\u043e' : 'Number of free posts ready to accept a vehicle' },
          { sep: true },
          { label: isRu ? '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e \u0417\u041d' : 'Completed WO', value: stats.completedWO, color: 'var(--success)', icon: FileText,
            tip: isRu ? '\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437-\u043d\u0430\u0440\u044f\u0434\u043e\u0432 \u0437\u0430 \u0442\u0435\u043a\u0443\u0449\u0443\u044e \u0441\u043c\u0435\u043d\u0443' : 'Number of completed work orders this shift' },
          { label: isRu ? '\u041d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441\u044b' : 'Norm hours', value: stats.totalNormHours, color: 'var(--text-primary)', icon: Clock,
            tip: isRu ? '\u0421\u0443\u043c\u043c\u0430 \u043d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441\u043e\u0432 \u043f\u043e \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u043c \u0437\u0430\u043a\u0430\u0437-\u043d\u0430\u0440\u044f\u0434\u0430\u043c' : 'Total norm hours from completed work orders' },
          { label: isRu ? '\u041f\u0440\u043e\u0441\u0442\u043e\u0439' : 'Idle time', value: stats.idleTime, color: 'var(--text-muted)', icon: Timer,
            tip: isRu ? '\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f, \u043a\u043e\u0433\u0434\u0430 \u043f\u043e\u0441\u0442\u044b \u0431\u044b\u043b\u0438 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b \u0432 \u0442\u0435\u0447\u0435\u043d\u0438\u0435 \u0441\u043c\u0435\u043d\u044b' : 'Total time posts were idle during the shift' },
          { label: isRu ? '\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0430' : 'Overdue', value: stats.overdueTime, color: 'var(--danger)', icon: AlertTriangle,
            tip: isRu ? '\u0421\u0443\u043c\u043c\u0430\u0440\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u0437\u0430\u0434\u0435\u0440\u0436\u043a\u0438 \u2014 \u0440\u0430\u0431\u043e\u0442\u044b \u0438\u0434\u0443\u0442 \u0434\u043e\u043b\u044c\u0448\u0435 \u0437\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0433\u043e' : 'Total overdue time \u2014 work taking longer than planned' },
          { label: isRu ? '\u0422\u0443\u0440\u0431\u043e' : 'Turbo', value: stats.savedTime, color: 'var(--success)', icon: ArrowRight,
            tip: isRu ? '\u0421\u044d\u043a\u043e\u043d\u043e\u043c\u043b\u0435\u043d\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u2014 \u0440\u0430\u0431\u043e\u0442\u044b \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b \u0431\u044b\u0441\u0442\u0440\u0435\u0435 \u043d\u043e\u0440\u043c\u043e-\u0447\u0430\u0441\u043e\u0432' : 'Saved time \u2014 work completed faster than norm hours' },
        ].map((card, i) => card.sep ? (
          <div key={i} style={{ width: 1, background: 'var(--border-glass)', alignSelf: 'stretch' }} />
        ) : (
          <div
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg relative group"
            style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
          >
            <div className="absolute top-full left-0 mt-1 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
              style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', width: 220, fontSize: '12px', lineHeight: 1.4 }}>
              {card.tip}
            </div>
            <card.icon size={11} style={{ color: card.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
            <span className="text-sm font-bold" style={{ color: card.color }}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <Legend t={t} />

      {/* Gantt Timeline */}
      <GanttTimeline
        posts={posts}
        shiftStart={todayShift.shiftStart}
        shiftEnd={todayShift.shiftEnd}
        onBlockClick={handleBlockClick}
        onDrop={handleDrop}
        conflictItemIds={conflictItemIds}
      />

      {/* Free work orders */}
      <FreeWorkOrdersTable orders={data?.freeWorkOrders} t={t} />

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
