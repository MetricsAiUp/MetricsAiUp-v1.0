import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import PostTimer from '../components/PostTimer';
import {
  Wrench, Car, Clock, Play, Pause, CheckCircle, Timer, FileText, User,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';

const BASE = import.meta.env.BASE_URL || './';

export default function MyPost() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [myPost, setMyPost] = useState(null);
  const [workStatus, setWorkStatus] = useState('idle'); // idle | working | paused
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}data/dashboard-posts.json?t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        // Find mechanic's assigned post from shifts or by user firstName match
        const posts = d?.posts || [];
        const found = posts.find(p => {
          const wo = p.timeline?.find(i => i.status === 'in_progress');
          return wo?.worker?.toLowerCase().includes(user?.firstName?.toLowerCase());
        }) || posts.find(p => p.number === (user?.assignedPost || 1));
        setMyPost(found || posts[0]);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 5000);

  // Timer tick
  useEffect(() => {
    if (workStatus !== 'working') return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - (startedAt || Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [workStatus, startedAt]);

  const handleStart = () => {
    setWorkStatus('working');
    setStartedAt(Date.now());
  };
  const handlePause = () => setWorkStatus('paused');
  const handleResume = () => {
    setWorkStatus('working');
    setStartedAt(Date.now() - elapsedMs);
  };
  const handleFinish = () => {
    setWorkStatus('idle');
    setElapsedMs(0);
    setStartedAt(null);
    // In real app — POST /api/work-orders/:id/complete
  };

  const currentWO = myPost?.timeline?.find(i => i.status === 'in_progress');
  const currentVehicle = myPost?.currentVehicle;

  const fmtElapsed = () => {
    const s = Math.floor(elapsedMs / 1000);
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

          {/* Deadline timer */}
          {(currentWO.endTime || currentWO.estimatedEnd) && (
            <div className="mb-4">
              <PostTimer
                estimatedEnd={currentWO.endTime || currentWO.estimatedEnd}
                startTime={currentWO.startTime}
                size="lg"
              />
            </div>
          )}

          {/* Elapsed timer */}
          <div className="text-4xl font-mono font-bold mb-4"
            style={{ color: workStatus === 'working' ? 'var(--accent)' : 'var(--text-muted)' }}>
            {fmtElapsed()}
          </div>

          {/* Control buttons */}
          <div className="flex gap-3 justify-center">
            {workStatus === 'idle' && (
              <button onClick={handleStart}
                className="flex-1 max-w-[200px] flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#10b981' }}>
                <Play size={24} /> {t('myPost.start')}
              </button>
            )}
            {workStatus === 'working' && (
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
            {workStatus === 'paused' && (
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
