import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { Car, CircleCheck, Wrench, Lightbulb } from 'lucide-react';

const EVENT_TYPES = {
  vehicle_entered_zone: { ru: 'Авто въехало', en: 'Vehicle entered' },
  vehicle_left_zone: { ru: 'Авто уехало', en: 'Vehicle left' },
  vehicle_moving: { ru: 'Движение', en: 'Moving' },
  vehicle_waiting: { ru: 'Ожидание', en: 'Waiting' },
  post_occupied: { ru: 'Пост занят', en: 'Post occupied' },
  post_vacated: { ru: 'Пост свободен', en: 'Post vacated' },
  worker_present: { ru: 'Работник пришёл', en: 'Worker arrived' },
  worker_absent: { ru: 'Работник ушёл', en: 'Worker left' },
  work_activity: { ru: 'Активная работа', en: 'Active work' },
  work_idle: { ru: 'Простой', en: 'Idle' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: color + '15' }}>
          <Icon size={20} style={{ color }} />
        </div>
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function RecommendationCard({ rec, onAcknowledge, t }) {
  const typeColors = {
    no_show: 'var(--danger)',
    post_free: 'var(--success)',
    capacity_available: 'var(--info)',
    work_overtime: 'var(--warning)',
    vehicle_idle: 'var(--warning)',
  };

  return (
    <div className="glass p-4 flex items-center justify-between">
      <div>
        <span
          className="text-xs font-medium px-2 py-1 rounded-full"
          style={{ background: typeColors[rec.type] + '22', color: typeColors[rec.type] }}
        >
          {t(`recommendations.${rec.type}`)}
        </span>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {rec.message}
        </p>
      </div>
      <button
        onClick={() => onAcknowledge(rec.id)}
        className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
        style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
      >
        {t('recommendations.acknowledge')}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();
  const [overview, setOverview] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState('all');

  const fetchData = async () => {
    try {
      const [ovRes, recRes, evRes] = await Promise.all([
        api.get('/api/dashboard/overview'),
        api.get('/api/recommendations'),
        api.get('/api/events?limit=10'),
      ]);
      setOverview(ovRes.data);
      setRecommendations(recRes.data);
      setEvents(evRes.data.events || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);
  usePolling(fetchData, 5000);

  const acknowledgeRec = async (id) => {
    await api.put(`/api/recommendations/${id}/acknowledge`);
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const freePostsCount = overview?.postsStatus?.find(p => p.status === 'free')?._count || 0;
  const occupiedCount = overview?.postsStatus
    ?.filter(p => p.status !== 'free')
    ?.reduce((sum, p) => sum + p._count, 0) || 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {t('nav.dashboard')}
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Car}
          label={t('dashboard.activeSessions')}
          value={overview?.activeSessions || 0}
          color="var(--accent)"
        />
        <StatCard
          icon={CircleCheck}
          label={t('dashboard.freePosts')}
          value={freePostsCount}
          color="var(--success)"
        />
        <StatCard
          icon={Wrench}
          label={t('dashboard.occupiedPosts')}
          value={occupiedCount}
          color="var(--warning)"
        />
        <StatCard
          icon={Lightbulb}
          label={t('dashboard.recommendations')}
          value={overview?.activeRecommendations || 0}
          color="var(--info)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendations */}
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('recommendations.title')}
          </h3>
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="glass p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('common.noData')}
              </div>
            ) : (
              recommendations.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onAcknowledge={acknowledgeRec}
                  t={t}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('dashboard.recentEvents')}
          </h3>
          <div className="flex flex-wrap gap-1 mb-3">
            <button onClick={() => setEventFilter('all')}
              className="px-2 py-1 rounded text-xs" style={{
                background: eventFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
                color: eventFilter === 'all' ? 'white' : 'var(--text-muted)',
              }}>{isRu ? 'Все' : 'All'}</button>
            {[...new Set(events.map(e => e.type))].slice(0, 5).map(type => (
              <button key={type} onClick={() => setEventFilter(type)}
                className="px-2 py-1 rounded text-xs" style={{
                  background: eventFilter === type ? 'var(--accent)' : 'var(--bg-glass)',
                  color: eventFilter === type ? 'white' : 'var(--text-muted)',
                }}>{EVENT_TYPES[type]?.[isRu ? 'ru' : 'en'] || type}</button>
            ))}
          </div>
          <div className="glass-static overflow-hidden">
            {events.length === 0 ? (
              <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('common.noData')}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {events.filter(ev => eventFilter === 'all' || ev.type === eventFilter).map(ev => (
                  <div key={ev.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {EVENT_TYPES[ev.type]?.[isRu ? 'ru' : 'en'] || ev.type}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        {ev.zone?.name}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(ev.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
