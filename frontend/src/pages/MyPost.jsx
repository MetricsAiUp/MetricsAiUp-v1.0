import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { useWorkOrderTimer } from '../hooks/useWorkOrderTimer';
import PostTimer from '../components/PostTimer';
import {
  Wrench, Car, Clock, Play, Pause, CheckCircle, Timer, FileText, User, AlertTriangle,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';

const BASE = import.meta.env.BASE_URL || './';

export default function MyPost() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [myPost, setMyPost] = useState(null);
  const [activeWO, setActiveWO] = useState(null);

  const timer = useWorkOrderTimer(activeWO, api);

  const fetchData = useCallback(async () => {
    try {
      // Try to get real WO from API first
      try {
        const woRes = await api.get('/api/work-orders?status=in_progress&limit=50');
        const orders = woRes?.data?.orders || woRes?.orders || [];
        const myWO = orders.find(o =>
          o.worker?.toLowerCase().includes(user?.firstName?.toLowerCase())
        );
        if (myWO) {
          setActiveWO(myWO);
        }
      } catch { /* fallback to mock data */ }

      const dpRes = await api.get('/api/dashboard-posts');
      if (dpRes?.data) {
        const d = dpRes.data;
        setData(d);
        const posts = d?.posts || [];
        const found = posts.find(p => {
          const wo = p.timeline?.find(i => i.status === 'in_progress');
          return wo?.worker?.toLowerCase().includes(user?.firstName?.toLowerCase());
        }) || posts.find(p => p.number === (user?.assignedPost || 1));
        setMyPost(found || posts[0]);

        // If no real WO found, use mock timeline data
        if (!activeWO && found) {
          const mockWO = found.timeline?.find(i => i.status === 'in_progress');
          if (mockWO) setActiveWO(mockWO);
        }
      }
    } catch { /* ignore */ }
  }, [user, api]);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 5000);

  const handleStart = async () => {
    try {
      const res = await timer.start();
      if (res?.data?.order) setActiveWO(res.data.order);
      else fetchData();
    } catch { /* fallback - just refetch */ fetchData(); }
  };
  const handlePause = async () => {
    try {
      const res = await timer.pause();
      if (res?.data?.order) setActiveWO(res.data.order);
      else fetchData();
    } catch { fetchData(); }
  };
  const handleResume = async () => {
    try {
      const res = await timer.resume();
      if (res?.data?.order) setActiveWO(res.data.order);
      else fetchData();
    } catch { fetchData(); }
  };
  const handleFinish = async () => {
    try {
      const res = await timer.complete();
      if (res?.data?.order) setActiveWO(null);
      else fetchData();
    } catch { fetchData(); }
  };

  const currentWO = activeWO || myPost?.timeline?.find(i => i.status === 'in_progress');
  const currentVehicle = myPost?.currentVehicle;

  const fmtElapsed = () => {
    const ms = timer.elapsedMs;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 p-2">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Wrench size={24} style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('myPost.title')}
          </h1>
          <HelpButton pageKey="myPost" />
        </div>
        {myPost && (
          <div className="text-lg font-medium" style={{ color: 'var(--accent)' }}>
            {t(`posts.post${myPost.number}`)}
          </div>
        )}
        {!myPost && (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('myPost.noPost')}
          </div>
        )}
      </div>

      {/* Current WO card */}
      <div className="glass rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('myPost.currentWO')}
          </span>
        </div>

        {currentWO ? (
          <div className="space-y-3">
            <div className="text-lg font-mono font-bold" style={{ color: 'var(--accent)' }}>
              {currentWO.workOrderNumber}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <Car size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('myPost.vehicle')}</span>
                </div>
                <div className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {currentVehicle?.plateNumber || currentWO.plateNumber || '---'}
                </div>
                {currentVehicle && (
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {currentVehicle.brand} {currentVehicle.model}
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <Wrench size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('myPost.workType')}</span>
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {currentWO.workType}
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('myPost.normHours')}</span>
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {currentWO.normHours} {isRu ? 'ч' : 'h'}
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <User size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('myPost.status')}</span>
                </div>
                <div className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                  {t('workOrders.in_progress')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <Wrench size={40} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">{t('myPost.noActiveWO')}</div>
          </div>
        )}
      </div>

      {/* Timer */}
      {currentWO && (
        <div className="glass rounded-2xl p-5 text-center" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Timer size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('myPost.workTimer')}
            </span>
          </div>

          {/* Warning badge */}
          {timer.warningLevel === 'warning' && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <AlertTriangle size={14} /> {t('myPost.warningNormHours')}
            </div>
          )}
          {(timer.warningLevel === 'critical' || timer.warningLevel === 'overtime') && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={14} /> {t('myPost.overtimeAlert')}
            </div>
          )}

          {/* Paused label */}
          {timer.isPaused && (
            <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Pause size={14} /> {t('myPost.pausedLabel')}
            </div>
          )}

          {/* Deadline timer */}
          {(currentWO.endTime || currentWO.estimatedEnd) && (
            <div className="mb-4">
              <PostTimer
                estimatedEnd={currentWO.endTime || currentWO.estimatedEnd}
                startTime={currentWO.startTime}
                size="lg"
                warningThreshold={0.8}
              />
            </div>
          )}

          {/* Elapsed timer */}
          <div className="text-4xl font-mono font-bold mb-4"
            style={{ color: timer.isRunning ? 'var(--accent)' : timer.isPaused ? '#f59e0b' : 'var(--text-muted)' }}>
            {fmtElapsed()}
          </div>

          {/* Progress bar */}
          {currentWO.normHours > 0 && (
            <div className="mb-4 mx-auto max-w-[300px]">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-glass)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(timer.percentUsed, 100)}%`,
                    background: timer.warningLevel === 'overtime' ? '#ef4444' : timer.warningLevel === 'critical' ? '#ef4444' : timer.warningLevel === 'warning' ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {timer.percentUsed.toFixed(0)}%
              </div>
            </div>
          )}

          {/* Control buttons */}
          <div className="flex gap-3 justify-center">
            {!timer.isRunning && !timer.isPaused && currentWO.status !== 'completed' && (
              <button onClick={handleStart}
                className="flex-1 max-w-[200px] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#10b981' }}>
                <Play size={24} /> {t('myPost.start')}
              </button>
            )}
            {timer.isRunning && (
              <>
                <button onClick={handlePause}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#f59e0b' }}>
                  <Pause size={24} /> {t('myPost.pause')}
                </button>
                <button onClick={handleFinish}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#10b981' }}>
                  <CheckCircle size={24} /> {t('myPost.finish')}
                </button>
              </>
            )}
            {timer.isPaused && (
              <>
                <button onClick={handleResume}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--accent)' }}>
                  <Play size={24} /> {t('myPost.resume')}
                </button>
                <button onClick={handleFinish}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#10b981' }}>
                  <CheckCircle size={24} /> {t('myPost.finish')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
