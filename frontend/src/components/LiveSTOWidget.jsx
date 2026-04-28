import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { Activity, Car, MapPin } from 'lucide-react';
import { POST_STATUS_COLORS } from '../constants';

const STATUS_DOT_COLORS = {
  free: POST_STATUS_COLORS.free || '#22c55e',
  occupied: POST_STATUS_COLORS.occupied || '#ef4444',
  occupied_no_work: POST_STATUS_COLORS.occupied_no_work || '#f59e0b',
  active_work: POST_STATUS_COLORS.active_work || '#6366f1',
  no_data: POST_STATUS_COLORS.no_data || '#64748b',
};

const ZONE_DOT_COLORS = {
  free: '#22c55e',
  occupied: '#ef4444',
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

  const { summary, posts, freeZones, vehiclesOnSite, mode } = data;
  const isLive = mode === 'live';

  return (
    <div className="glass-static p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('liveWidget.title')}
          </h3>
          {isLive && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
              LIVE
            </span>
          )}
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
        {isLive && summary.zonesOccupied != null && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
            {summary.zonesOccupied} {isRu ? 'зон занято' : 'zones occupied'}
          </span>
        )}
      </div>

      {/* Posts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {posts.map(post => {
          const num = post.number ?? parseInt(post.name?.match(/\d+/)?.[0] || '0', 10);
          const isNoData = post.status === 'no_data';
          const dotColor = STATUS_DOT_COLORS[post.status] || '#94a3b8';
          const noDataTitle = isRu
            ? 'Нет данных от CV-системы. Пост существует в БД и на карте, но не репортится.'
            : 'No data from CV system. Post exists in DB and map but is not reported.';
          return (
            <div
              key={post.id}
              title={isNoData ? noDataTitle : undefined}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                opacity: isNoData ? 0.55 : 1,
                fontStyle: isNoData ? 'italic' : 'normal',
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={isNoData
                  ? { background: 'transparent', border: '1px dashed var(--text-muted)' }
                  : { background: dotColor }
                }
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium block" style={{ color: 'var(--text-primary)' }}>
                  {num > 0 ? (isRu ? `П${num}` : `P${num}`) : post.name}
                </span>
                <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                  {isNoData
                    ? (isRu ? 'Нет данных' : 'No data')
                    : (post.plateNumber || (isLive && post.carModel ? post.carModel : t('liveWidget.noVehicle')))}
                </span>
              </div>
              {!isNoData && (post.startTime || post.carFirstSeen) && (
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {timeSince(post.startTime || post.carFirstSeen)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Free zones grid (live mode only) */}
      {isLive && freeZones && freeZones.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-3 mb-2">
            <MapPin size={14} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Свободные зоны' : 'Free Zones'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {freeZones.map(zone => {
              const dotColor = ZONE_DOT_COLORS[zone.status] || '#94a3b8';
              return (
                <div
                  key={zone.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium block" style={{ color: 'var(--text-primary)' }}>
                      {zone.name}
                    </span>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                      {zone.plateNumber || zone.carModel || (zone.status === 'free' ? (isRu ? 'Свободна' : 'Free') : (isRu ? 'Занята' : 'Occupied'))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
