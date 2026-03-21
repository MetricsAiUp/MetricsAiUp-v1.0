import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket, useSubscribe } from '../hooks/useSocket';
import STOMap from '../components/STOMap';

const statusColors = {
  free: '#10b981',
  occupied: '#f59e0b',
  occupied_no_work: '#ef4444',
  active_work: '#6366f1',
};

export default function MapView() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const { theme } = useTheme();
  const [zones, setZones] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  useSubscribe('all');

  const fetchZones = async () => {
    try {
      const res = await api.get('/api/zones');
      setZones(res.data);
    } catch (err) {
      console.error('Zones fetch error:', err);
    }
  };

  useEffect(() => { fetchZones(); }, []);
  useSocket('zone:update', () => { fetchZones(); });
  useSocket('event', () => { fetchZones(); });

  const isDark = theme === 'dark';

  // Подсчёт статусов
  const allPosts = zones.flatMap(z => z.posts || []);
  const statusCounts = allPosts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('nav.map')}
        </h2>
        {/* Status summary */}
        <div className="flex gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: (statusColors[status] || '#94a3b8') + '15' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: statusColors[status] }}
              />
              <span className="text-xs font-medium" style={{ color: statusColors[status] }}>
                {count}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t(`posts.${status}`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive map */}
      <div className="glass-static p-4 overflow-hidden">
        <STOMap
          zones={zones}
          isDark={isDark}
          onPostClick={(post) => setSelectedPost(post)}
        />
      </div>

      {/* Selected post details panel */}
      {selectedPost && (
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: statusColors[selectedPost.status] }}
              />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedPost.name}
              </h3>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: (statusColors[selectedPost.status] || '#94a3b8') + '22',
                  color: statusColors[selectedPost.status],
                }}
              >
                {t(`posts.${selectedPost.status}`)}
              </span>
            </div>
            <button
              onClick={() => setSelectedPost(null)}
              className="text-sm px-3 py-1 rounded-lg hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current vehicle */}
            <div className="glass p-4">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('sessions.currentPost')}
              </p>
              {selectedPost.stays?.[0]?.vehicleSession ? (
                <div>
                  <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {selectedPost.stays[0].vehicleSession.plateNumber || '—'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('sessions.entryTime')}: {new Date(selectedPost.stays[0].startTime).toLocaleTimeString()}
                  </p>
                </div>
              ) : (
                <p className="text-lg" style={{ color: 'var(--text-muted)' }}>—</p>
              )}
            </div>

            {/* Post type */}
            <div className="glass p-4">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('posts.title')}
              </p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {t(`posts.${selectedPost.type}`)}
              </p>
            </div>

            {/* Zone */}
            <div className="glass p-4">
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('zones.title')}
              </p>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {selectedPost.zone?.name || zones.find(z => z.posts?.some(p => p.id === selectedPost.id))?.name || '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zones summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {zones.map(zone => {
          const vehicleCount = zone._count?.stays || 0;
          const zoneColor = {
            entry: '#10b981', waiting: '#f59e0b',
            repair: '#6366f1', parking: '#3b82f6', free: '#94a3b8',
          }[zone.type] || '#94a3b8';

          return (
            <div key={zone.id} className="glass p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: zoneColor }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {zone.name.split('—')[0].trim()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t(`zones.${zone.type}`)}
                </span>
                <span className="text-sm font-bold" style={{ color: zoneColor }}>
                  {vehicleCount > 0 ? `🚗 ${vehicleCount}` : '—'}
                </span>
              </div>
              {zone.posts?.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {zone.posts.map(p => (
                    <span
                      key={p.id}
                      className="w-4 h-4 rounded"
                      style={{ background: statusColors[p.status] || '#94a3b8' }}
                      title={`${p.name}: ${p.status}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
