import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSocket, useSubscribe } from '../hooks/useSocket';

const statusColors = {
  free: '#10b981',
  occupied: '#f59e0b',
  occupied_no_work: '#ef4444',
  active_work: '#6366f1',
};

function PostCard({ post, t }) {
  const color = statusColors[post.status] || '#94a3b8';
  const currentVehicle = post.stays?.[0]?.vehicleSession;

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          {post.name}
        </span>
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: color }}
          title={t(`posts.${post.status}`)}
        />
      </div>
      <span
        className="text-xs px-2 py-1 rounded-full"
        style={{ background: color + '22', color }}
      >
        {t(`posts.${post.status}`)}
      </span>
      {currentVehicle && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {currentVehicle.plateNumber || `Track: ${currentVehicle.trackId?.slice(0, 8)}`}
        </p>
      )}
    </div>
  );
}

export default function MapView() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [zones, setZones] = useState([]);

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

  const zoneTypeColors = {
    repair: 'var(--accent)',
    waiting: 'var(--warning)',
    entry: 'var(--success)',
    parking: 'var(--info)',
    free: 'var(--text-muted)',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {t('nav.map')}
      </h2>

      {/* Map placeholder — will integrate react-konva with floor plan later */}
      <div
        className="glass-static p-8 flex items-center justify-center"
        style={{ minHeight: 300 }}
      >
        <p style={{ color: 'var(--text-muted)' }}>
          🗺️ Карта СТО — загрузите план помещения для интерактивной карты
        </p>
      </div>

      {/* Zones grid */}
      <div className="space-y-6">
        {zones.map(zone => (
          <div key={zone.id}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: zoneTypeColors[zone.type] }}
              />
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {zone.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                background: zoneTypeColors[zone.type] + '22',
                color: zoneTypeColors[zone.type],
              }}>
                {t(`zones.${zone.type}`)}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({zone._count?.stays || 0} авто)
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {zone.posts?.map(post => (
                <PostCard key={post.id} post={post} t={t} />
              ))}
              {(!zone.posts || zone.posts.length === 0) && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('common.noData')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
