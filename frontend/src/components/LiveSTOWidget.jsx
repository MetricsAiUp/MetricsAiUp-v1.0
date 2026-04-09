import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { Activity, Car } from 'lucide-react';
import { POST_STATUS_COLORS } from '../constants';

const STATUS_DOT_COLORS = {
  free: POST_STATUS_COLORS.free || '#22c55e',
  occupied: POST_STATUS_COLORS.occupied || '#ef4444',
  occupied_no_work: POST_STATUS_COLORS.occupied_no_work || '#f59e0b',
  active_work: POST_STATUS_COLORS.active_work || '#6366f1',
};

function timeSince(startTime) {
  if (!startTime) return '';
  const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
  if (diff < 1) return '<1m';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export default function LiveSTOWidget() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const isRu = i18n.language === 'ru';
  const [data, setData] = useState(null);

  const fetchLive = async () => {
    try {
      const res = await api.get('/api/dashboard/live');
      setData(res.data);
    } catch {
      // fallback: ignore
    }
  };

  useEffect(() => { fetchLive(); }, []);
  usePolling(fetchLive, 10000);

  if (!data) return null;

  const { summary, posts, vehiclesOnSite } = data;

  return (
    <div className="glass-static p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('liveWidget.title')}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Car size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              {vehiclesOnSite} {t('liveWidget.vehiclesOnSite').toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
          {summary.working} {t('liveWidget.working').toLowerCase()}
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
          {summary.idle} {t('liveWidget.idle').toLowerCase()}
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
          {summary.free} {t('liveWidget.free').toLowerCase()}
        </span>
      </div>

      {/* Posts table */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {posts.map(post => {
          const num = post.name?.match(/\d+/)?.[0];
          const dotColor = STATUS_DOT_COLORS[post.status] || '#94a3b8';
          return (
            <div
              key={post.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium block" style={{ color: 'var(--text-primary)' }}>
                  {num ? (isRu ? `П${num}` : `P${num}`) : post.name}
                </span>
                <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                  {post.plateNumber || t('liveWidget.noVehicle')}
                </span>
              </div>
              {post.startTime && (
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {timeSince(post.startTime)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
