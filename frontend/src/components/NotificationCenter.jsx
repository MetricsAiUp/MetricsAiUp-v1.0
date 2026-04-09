import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, X, AlertTriangle, Clock, Car, Settings, Check, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';

const STORAGE_KEY = 'notificationCenter';
const MAX_NOTIFICATIONS = 50;

const NOTIFICATION_TYPES = {
  no_show: { icon: AlertTriangle, color: '#ef4444', severity: 'critical' },
  vehicle_idle: { icon: Clock, color: '#f59e0b', severity: 'warning' },
  work_overtime: { icon: Clock, color: '#ef4444', severity: 'critical' },
  post_free: { icon: Car, color: '#10b981', severity: 'info' },
  capacity_available: { icon: Car, color: '#3b82f6', severity: 'info' },
};

const TYPE_LABELS = {
  ru: {
    no_show: 'Неявка',
    vehicle_idle: 'Простой авто',
    work_overtime: 'Превышение времени',
    post_free: 'Пост свободен',
    capacity_available: 'Есть мощности',
  },
  en: {
    no_show: 'No-show',
    vehicle_idle: 'Vehicle idle',
    work_overtime: 'Work overtime',
    post_free: 'Post free',
    capacity_available: 'Capacity available',
  },
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { notifications: [], enabledTypes: Object.keys(NOTIFICATION_TYPES).reduce((a, k) => ({ ...a, [k]: true }), {}), soundEnabled: true };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function NotificationCenter() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const isRu = i18n.language === 'ru';

  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [state, setState] = useState(loadState);
  const [toast, setToast] = useState(null);
  const lastCheckRef = useRef(Date.now());
  const dropdownRef = useRef(null);

  const { notifications, enabledTypes, soundEnabled } = state;
  const unreadCount = notifications.filter(n => !n.read).length;

  // Save state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const seenIdsRef = useRef(new Set());

  // Initial fetch of existing recommendations on mount
  useEffect(() => {
    api.get('/api/recommendations').then(({ data }) => {
      if (!data || !Array.isArray(data)) return;
      // Mark existing ones as seen to avoid duplicates
      data.forEach(rec => seenIdsRef.current.add(rec.id));
      lastCheckRef.current = Date.now();
    }).catch(() => {});
  }, []);

  // Live Socket.IO listener for new recommendations
  const handleSocketRecommendation = useCallback((rec) => {
    if (!rec || seenIdsRef.current.has(rec.id)) return;
    seenIdsRef.current.add(rec.id);

    if (!enabledTypes[rec.type]) return;

    const notif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: rec.type,
      message: isRu ? rec.message : (rec.messageEn || rec.message),
      postId: rec.postId,
      zoneId: rec.zoneId,
      time: new Date().toISOString(),
      read: false,
    };

    setState(prev => ({
      ...prev,
      notifications: [notif, ...prev.notifications].slice(0, MAX_NOTIFICATIONS),
    }));

    const typeInfo = NOTIFICATION_TYPES[rec.type];
    if (typeInfo?.severity === 'critical') {
      setToast(notif);
      if (soundEnabled) playNotificationSound();
      setTimeout(() => setToast(null), 5000);
    }
  }, [enabledTypes, soundEnabled, isRu]);

  useSocket('recommendation', handleSocketRecommendation);

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* ignore */ }
  };

  const markAllRead = () => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
    }));
  };

  const clearAll = () => {
    setState(prev => ({ ...prev, notifications: [] }));
  };

  const toggleType = (type) => {
    setState(prev => ({
      ...prev,
      enabledTypes: { ...prev.enabledTypes, [type]: !prev.enabledTypes[type] },
    }));
  };

  const toggleSound = () => {
    setState(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const formatTime = (t) => {
    const d = new Date(t);
    return d.toLocaleTimeString(isRu ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1"
            style={{ background: '#ef4444', color: '#fff' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] rounded-xl shadow-2xl overflow-hidden z-50"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Уведомления' : 'Notifications'} {unreadCount > 0 && `(${unreadCount})`}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={toggleSound} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}
                title={soundEnabled ? 'Mute' : 'Unmute'}>
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded hover:opacity-80"
                style={{ color: showSettings ? 'var(--accent)' : 'var(--text-muted)' }}>
                <Settings size={14} />
              </button>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}
                  title={isRu ? 'Пометить все как прочитанные' : 'Mark all read'}>
                  <Check size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--text-muted)' }}
                  title={isRu ? 'Очистить все' : 'Clear all'}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="px-3 py-2 space-y-1" style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Типы уведомлений' : 'Notification types'}
              </p>
              {Object.keys(NOTIFICATION_TYPES).map(type => (
                <label key={type} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={enabledTypes[type] !== false} onChange={() => toggleType(type)} className="rounded" />
                  <span className="w-2 h-2 rounded-full" style={{ background: NOTIFICATION_TYPES[type].color }} />
                  {TYPE_LABELS[isRu ? 'ru' : 'en'][type] || type}
                </label>
              ))}
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {isRu ? 'Нет уведомлений' : 'No notifications'}
              </div>
            ) : notifications.map(notif => {
              const typeInfo = NOTIFICATION_TYPES[notif.type] || {};
              const Icon = typeInfo.icon || AlertTriangle;
              return (
                <div key={notif.id}
                  className="flex items-start gap-2.5 px-3 py-2.5 hover:opacity-80 transition-opacity"
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    background: notif.read ? 'transparent' : 'var(--accent-light)',
                    opacity: notif.read ? 0.7 : 1,
                  }}>
                  <div className="mt-0.5 flex-shrink-0">
                    <Icon size={14} style={{ color: typeInfo.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: (typeInfo.color || '#94a3b8') + '1a', color: typeInfo.color }}>
                        {TYPE_LABELS[isRu ? 'ru' : 'en'][notif.type] || notif.type}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(notif.time)}</span>
                    </div>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>{notif.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 w-80 rounded-xl shadow-2xl p-3 flex items-start gap-3 animate-slide-in"
          style={{ background: 'var(--bg-primary)', border: `2px solid ${NOTIFICATION_TYPES[toast.type]?.color || '#ef4444'}` }}>
          <AlertTriangle size={18} style={{ color: NOTIFICATION_TYPES[toast.type]?.color || '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-xs font-bold mb-0.5" style={{ color: NOTIFICATION_TYPES[toast.type]?.color || '#ef4444' }}>
              {TYPE_LABELS[isRu ? 'ru' : 'en'][toast.type] || toast.type}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="p-0.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
