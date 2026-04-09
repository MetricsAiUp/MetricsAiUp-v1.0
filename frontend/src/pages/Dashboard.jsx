import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { Car, CircleCheck, Wrench, Lightbulb } from 'lucide-react';
import { translateZone } from '../utils/translate';
import HelpButton from '../components/HelpButton';
import PredictionWidget from '../components/PredictionWidget';
import LiveSTOWidget from '../components/LiveSTOWidget';


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
    <div className="glass px-3 py-2 flex items-center gap-2">
      <div className="p-1 rounded-md" style={{ background: color + '15' }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function RecommendationCard({ rec, onAcknowledge, t, isRu }) {
  const typeColors = {
    no_show: 'var(--danger)',
    post_free: 'var(--success)',
    capacity_available: 'var(--info)',
    work_overtime: 'var(--warning)',
    vehicle_idle: 'var(--warning)',
  };

  return (
    <div className="glass p-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span
          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: typeColors[rec.type] + '22', color: typeColors[rec.type] }}
        >
          {t(`recommendations.${rec.type}`)}
        </span>
        <p className="mt-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {isRu ? rec.message : (rec.messageEn || rec.message)}
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
  const [recPage, setRecPage] = useState(1);
  const [evtPage, setEvtPage] = useState(1);
  const perPage = 5;
  const [trends, setTrends] = useState([]); // kept for future use

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
      api.get('/api/dashboard/trends').then(r => setTrends(r.data || [])).catch(() => {});
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

  // Reset pages on data/filter change
  useEffect(() => { setRecPage(1); }, [recommendations.length]);
  useEffect(() => { setEvtPage(1); }, [eventFilter]);

  const recTotalPages = Math.max(1, Math.ceil(recommendations.length / perPage));
  const paginatedRecs = recommendations.slice((recPage - 1) * perPage, recPage * perPage);

  const filteredEvents = useMemo(() =>
    events.filter(ev => eventFilter === 'all' || ev.type === eventFilter),
    [events, eventFilter]);
  const evtTotalPages = Math.max(1, Math.ceil(filteredEvents.length / perPage));
  const paginatedEvents = filteredEvents.slice((evtPage - 1) * perPage, evtPage * perPage);

  const freePostsCount = overview?.postsStatus?.find(p => p.status === 'free')?._count || 0;
  const occupiedCount = overview?.postsStatus
    ?.filter(p => p.status !== 'free')
    ?.reduce((sum, p) => sum + p._count, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('nav.dashboard')}
        </h2>
        <HelpButton pageKey="dashboard" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard icon={Car} label={t('dashboard.activeSessions')} value={overview?.activeSessions || 0} color="var(--accent)" />
        <StatCard icon={CircleCheck} label={t('dashboard.freePosts')} value={freePostsCount} color="var(--success)" />
        <StatCard icon={Wrench} label={t('dashboard.occupiedPosts')} value={occupiedCount} color="var(--warning)" />
        <StatCard icon={Lightbulb} label={t('dashboard.recommendations')} value={overview?.activeRecommendations || 0} color="var(--info)" />
      </div>

      {/* Live STO Widget */}
      <LiveSTOWidget />

      {/* ML Predictions */}
      <PredictionWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recommendations */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('recommendations.title')}
          </h3>
          <div className="space-y-1.5">
            {recommendations.length === 0 ? (
              <div className="glass p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('common.noData')}
              </div>
            ) : (
              paginatedRecs.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onAcknowledge={acknowledgeRec}
                  t={t}
                  isRu={isRu}
                />
              ))
            )}
          </div>
          {recTotalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(recPage - 1) * perPage + 1}–{Math.min(recPage * perPage, recommendations.length)} {isRu ? 'из' : 'of'} {recommendations.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setRecPage(p => p - 1)} disabled={recPage === 1}
                  className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--bg-glass)', color: recPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: recPage === 1 ? 0.5 : 1 }}>{'‹'}</button>
                {Array.from({ length: recTotalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setRecPage(p)}
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: recPage === p ? 'var(--accent)' : 'var(--bg-glass)', color: recPage === p ? 'white' : 'var(--text-muted)' }}>{p}</button>
                ))}
                <button onClick={() => setRecPage(p => p + 1)} disabled={recPage === recTotalPages}
                  className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--bg-glass)', color: recPage === recTotalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: recPage === recTotalPages ? 0.5 : 1 }}>{'›'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
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
            {filteredEvents.length === 0 ? (
              <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                {t('common.noData')}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {paginatedEvents.map(ev => (
                  <div key={ev.id} className="px-3 py-1.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {EVENT_TYPES[ev.type]?.[isRu ? 'ru' : 'en'] || ev.type}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        {translateZone(ev.zone?.name, isRu)}
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
          {evtTotalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(evtPage - 1) * perPage + 1}–{Math.min(evtPage * perPage, filteredEvents.length)} {isRu ? 'из' : 'of'} {filteredEvents.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setEvtPage(p => p - 1)} disabled={evtPage === 1}
                  className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--bg-glass)', color: evtPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: evtPage === 1 ? 0.5 : 1 }}>{'‹'}</button>
                {Array.from({ length: evtTotalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setEvtPage(p)}
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: evtPage === p ? 'var(--accent)' : 'var(--bg-glass)', color: evtPage === p ? 'white' : 'var(--text-muted)' }}>{p}</button>
                ))}
                <button onClick={() => setEvtPage(p => p + 1)} disabled={evtPage === evtTotalPages}
                  className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--bg-glass)', color: evtPage === evtTotalPages ? 'var(--text-muted)' : 'var(--text-primary)', opacity: evtPage === evtTotalPages ? 0.5 : 1 }}>{'›'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
