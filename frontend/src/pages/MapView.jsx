import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePolling } from '../hooks/useSocket';
import STOMap from '../components/STOMap';
import { translateZone, translatePost } from '../utils/translate';
import CameraStreamModal from '../components/CameraStreamModal';
import HelpButton from '../components/HelpButton';
import {
  X, Car, Clock, Timer, User, Wrench, FileText, AlertTriangle,
  ArrowRight, Camera, Maximize2,
} from 'lucide-react';

const ALL_CAMERAS = [
  { num: '01', loc: { ru: 'Нижний ряд, левый угол', en: 'Lower row, left corner' }, covers: { ru: 'Пост 1, Пост 2, Парковка', en: 'Post 1, Post 2, Parking' } },
  { num: '02', loc: { ru: 'Верхний ряд, левый угол', en: 'Upper row, left corner' }, covers: { ru: 'Пост 5, Пост 6', en: 'Post 5, Post 6' } },
  { num: '03', loc: { ru: 'Проезд, левая часть', en: 'Driveway, left' }, covers: { ru: 'Пост 1, Пост 2, Пост 3', en: 'Post 1, Post 2, Post 3' } },
  { num: '04', loc: { ru: 'Проезд, центр-лево', en: 'Driveway, center-left' }, covers: { ru: 'Пост 3, Пост 4', en: 'Post 3, Post 4' } },
  { num: '05', loc: { ru: 'Проезд, центр', en: 'Driveway, center' }, covers: { ru: 'Пост 6, Пост 7', en: 'Post 6, Post 7' } },
  { num: '06', loc: { ru: 'Проезд, центр-право', en: 'Driveway, center-right' }, covers: { ru: 'Пост 7, Пост 8', en: 'Post 7, Post 8' } },
  { num: '07', loc: { ru: 'Проезд, правая часть', en: 'Driveway, right' }, covers: { ru: 'Пост 8, Пост 9', en: 'Post 8, Post 9' } },
  { num: '08', loc: { ru: 'Правая стена, верх', en: 'Right wall, upper' }, covers: { ru: 'Пост 9, Пост 10', en: 'Post 9, Post 10' } },
  { num: '09', loc: { ru: 'Въезд/Выезд', en: 'Entry/Exit' }, covers: { ru: 'Въезд, Выезд, Парковка', en: 'Entry, Exit, Parking' } },
  { num: '10', loc: { ru: 'Правая стена, низ', en: 'Right wall, lower' }, covers: { ru: 'Пост 10', en: 'Post 10' } },
];

import { POST_STATUS_COLORS as statusColors } from '../constants';

// Modal for post details on map click
function PostModal({ post, dashboardData, onClose, onGoToPost, t, isRu }) {
  if (!post) return null;

  const statusColor = statusColors[post.status] || '#94a3b8';
  const vehicle = post.stays?.[0]?.vehicleSession;

  // Find matching dashboard data for this post
  const postDashboard = dashboardData?.posts?.find(p => {
    const num = post.name.match(/\d+/)?.[0];
    return p.number === parseInt(num, 10);
  });

  const currentWO = postDashboard?.timeline?.find(t => t.status === 'in_progress');
  const workers = postDashboard?.timeline?.find(t => t.status === 'in_progress');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-5 max-w-md w-full mx-4 shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: statusColor }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {(() => { const num = post.name?.match(/\d+/)?.[0]; return num ? t(`posts.post${num}`) : post.name; })()}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: statusColor + '22', color: statusColor }}
            >
              {t(`posts.${post.status}`)}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Vehicle info */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--accent-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Car size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('mapView.currentVehicle')}
              </span>
            </div>
            {vehicle ? (
              <div>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                  {vehicle.plateNumber}
                </span>
                {postDashboard?.currentVehicle && (
                  <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                    {postDashboard.currentVehicle.brand} {postDashboard.currentVehicle.model}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('posts.free')}</span>
            )}
          </div>

          {/* Work order */}
          {currentWO && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2 mb-1">
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('mapView.currentWO')}
                </span>
              </div>
              <div className="text-sm font-mono font-medium" style={{ color: 'var(--accent)' }}>
                {currentWO.workOrderNumber}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {currentWO.workType}
              </div>
            </div>
          )}

          {/* Worker */}
          {currentWO?.worker && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2 mb-1">
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('mapView.worker')}
                </span>
              </div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {currentWO.worker}
              </div>
            </div>
          )}

          {/* Time info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-1 mb-1">
                <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('mapView.placedAt')}
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {post.stays?.[0]?.startTime
                  ? new Date(post.stays[0].startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-1 mb-1">
                <Timer size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('mapView.estimatedEnd')}
                </span>
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {currentWO?.estimatedEnd
                  ? new Date(currentWO.estimatedEnd).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Note placeholder */}
          {currentWO?.note && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid var(--warning)' }}>
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
                  {t('mapView.note')}
                </span>
              </div>
              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {currentWO.note}
              </div>
            </div>
          )}

          {/* Post type & zone */}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{t(`posts.${post.type}`)}</span>
            <span>·</span>
            <span>{translateZone(post.zone?.name, isRu) || '—'}</span>
          </div>
        </div>

        {/* Go to post page button */}
        <button
          onClick={() => onGoToPost(post)}
          className="w-full mt-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('mapView.goToPost')}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function MapView() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedCam, setSelectedCam] = useState(null);

  const fetchZones = async () => {
    try {
      const res = await api.get('/api/zones');
      setZones(res.data);
    } catch (err) {
      console.error('Zones fetch error:', err);
    }
  };

  useEffect(() => {
    fetchZones();
    // Load dashboard data for post details
    api.get('/api/dashboard-posts')
      .then(({ data: res }) => setDashboardData(res))
      .catch(() => {});
  }, []);
  usePolling(fetchZones, 5000);

  const isDark = theme === 'dark';

  const allPosts = zones.flatMap(z => z.posts || []);
  const statusCounts = allPosts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const handleGoToPost = (post) => {
    const num = post.name.match(/\d+/)?.[0];
    setSelectedPost(null);
    navigate(`/posts-detail?post=post-${num}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('nav.map')}
          </h2>
          <HelpButton pageKey="map" />
        </div>
        <div className="flex gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: (statusColors[status] || '#94a3b8') + '15' }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColors[status] }} />
              <span className="text-xs font-medium" style={{ color: statusColors[status] }}>{count}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(`posts.${status}`)}</span>
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
          onCameraClick={(num) => setSelectedCam(num)}
          dashboardData={dashboardData}
        />
      </div>

      {/* Modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          dashboardData={dashboardData}
          onClose={() => setSelectedPost(null)}
          onGoToPost={handleGoToPost}
          t={t}
          isRu={isRu}
        />
      )}

      {selectedCam && (() => {
        const camData = ALL_CAMERAS.find(c => c.num === selectedCam);
        const lang = isRu ? 'ru' : 'en';
        return (
          <CameraStreamModal
            camId={`cam${selectedCam}`}
            camName={(isRu ? 'КАМ' : 'CAM') + selectedCam}
            camLocation={camData?.loc?.[lang] || ''}
            camCovers={camData?.covers?.[lang] || ''}
            isRu={isRu}
            isDark={isDark}
            onClose={() => setSelectedCam(null)}
          />
        );
      })()}

      {/* STO summary stats */}
      {(() => {
        const total = allPosts.length;
        const free = allPosts.filter(p => p.status === 'free').length;
        const occupied = total - free;
        const activeWork = allPosts.filter(p => p.status === 'active_work').length;
        const idle = allPosts.filter(p => p.status === 'occupied_no_work').length;
        const totalVehicles = zones.reduce((s, z) => s + (z._count?.stays || 0), 0);
        const freeWO = dashboardData?.freeWorkOrders?.length || 0;
        const loadPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

        const stats = [
          { label: isRu ? 'Всего постов' : 'Total posts', value: total, color: 'var(--text-primary)' },
          { label: isRu ? 'Занято' : 'Occupied', value: occupied, color: 'var(--danger)' },
          { label: isRu ? 'Свободно' : 'Free', value: free, color: 'var(--success)' },
          { label: isRu ? 'В работе' : 'Active work', value: activeWork, color: 'var(--accent)' },
          { label: isRu ? 'Простой' : 'Idle', value: idle, color: 'var(--warning)' },
          { label: isRu ? 'Авто на СТО' : 'Vehicles', value: totalVehicles, color: 'var(--info)' },
          { label: isRu ? 'В очереди' : 'In queue', value: freeWO, color: 'var(--text-muted)' },
          { label: isRu ? 'Загрузка' : 'Load', value: `${loadPct}%`, color: loadPct >= 70 ? 'var(--success)' : loadPct >= 30 ? 'var(--warning)' : 'var(--danger)' },
        ];

        return (
          <div className="flex flex-wrap gap-2">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
