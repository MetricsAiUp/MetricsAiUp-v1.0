import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';
import { translateZone, translatePost } from '../utils/translate';
import HelpButton from '../components/HelpButton';

const EVENT_TYPES = {
  vehicle_entered_zone: { ru: 'Авто въехало в зону', en: 'Vehicle entered zone' },
  vehicle_left_zone: { ru: 'Авто покинуло зону', en: 'Vehicle left zone' },
  vehicle_moving: { ru: 'Авто движется', en: 'Vehicle moving' },
  vehicle_waiting: { ru: 'Авто ожидает', en: 'Vehicle waiting' },
  post_occupied: { ru: 'Пост занят', en: 'Post occupied' },
  post_vacated: { ru: 'Пост освобождён', en: 'Post vacated' },
  worker_present: { ru: 'Работник на посту', en: 'Worker present' },
  worker_absent: { ru: 'Работник ушёл', en: 'Worker absent' },
  work_activity: { ru: 'Активная работа', en: 'Active work' },
  work_idle: { ru: 'Простой', en: 'Idle' },
};

export default function Events() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { api } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [postFilter, setPostFilter] = useState('all');
  const [sortDir, setSortDir] = useState('desc');

  const fetchEvents = async () => {
    try {
      const res = await api.get('/api/events?limit=50');
      setEvents(res.data.events || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchEvents(); }, []);
  usePolling(fetchEvents, 5000);

  const uniqueTypes = [...new Set(events.map(e => e.type))].sort();
  const uniqueZones = [...new Set(events.map(e => e.zone?.name).filter(Boolean))].sort();
  const uniquePosts = [...new Set(events.map(e => e.post?.name).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    return events
      .filter(e => typeFilter === 'all' || e.type === typeFilter)
      .filter(e => zoneFilter === 'all' || e.zone?.name === zoneFilter)
      .filter(e => postFilter === 'all' || e.post?.name === postFilter)
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return sortDir === 'desc' ? tb - ta : ta - tb;
      });
  }, [events, typeFilter, zoneFilter, postFilter, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('nav.events')}
          </h2>
          <HelpButton pageKey="events" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--accent)', border: '1px solid var(--border-glass)' }}>
            {isRu ? 'Время' : 'Time'} {sortDir === 'desc' ? '↓' : '↑'}
          </button>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} / {total}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Type filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs w-14" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Тип:' : 'Type:'}</span>
          <button onClick={() => setTypeFilter('all')}
            className="px-2.5 py-1 rounded-lg text-xs" style={{
              background: typeFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
              color: typeFilter === 'all' ? 'white' : 'var(--text-muted)',
            }}>{isRu ? 'Все' : 'All'}</button>
          {uniqueTypes.map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}
              className="px-2.5 py-1 rounded-lg text-xs" style={{
                background: typeFilter === type ? 'var(--accent)' : 'var(--bg-glass)',
                color: typeFilter === type ? 'white' : 'var(--text-muted)',
              }}>{EVENT_TYPES[type]?.[isRu ? 'ru' : 'en'] || type}</button>
          ))}
        </div>
        {/* Zone filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs w-14" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Зона:' : 'Zone:'}</span>
          <button onClick={() => setZoneFilter('all')}
            className="px-2.5 py-1 rounded-lg text-xs" style={{
              background: zoneFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
              color: zoneFilter === 'all' ? 'white' : 'var(--text-muted)',
            }}>{isRu ? 'Все' : 'All'}</button>
          {uniqueZones.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)}
              className="px-2.5 py-1 rounded-lg text-xs" style={{
                background: zoneFilter === z ? 'var(--accent)' : 'var(--bg-glass)',
                color: zoneFilter === z ? 'white' : 'var(--text-muted)',
              }}>{translateZone(z, isRu)}</button>
          ))}
        </div>
        {/* Post filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs w-14" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Пост:' : 'Post:'}</span>
          <button onClick={() => setPostFilter('all')}
            className="px-2.5 py-1 rounded-lg text-xs" style={{
              background: postFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
              color: postFilter === 'all' ? 'white' : 'var(--text-muted)',
            }}>{isRu ? 'Все' : 'All'}</button>
          {uniquePosts.map(p => (
            <button key={p} onClick={() => setPostFilter(p)}
              className="px-2.5 py-1 rounded-lg text-xs" style={{
                background: postFilter === p ? 'var(--accent)' : 'var(--bg-glass)',
                color: postFilter === p ? 'white' : 'var(--text-muted)',
              }}>{translatePost(p, isRu)}</button>
          ))}
        </div>
      </div>

      <div className="glass-static overflow-hidden">
        <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
          {filtered.map(ev => (
            <div key={ev.id} className="px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  {EVENT_TYPES[ev.type]?.[isRu ? 'ru' : 'en'] || ev.type.replace(/_/g, ' ')}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{translateZone(ev.zone?.name, isRu)}</span>
                {ev.post && (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>→ {translatePost(ev.post.name, isRu)}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'увер.' : 'conf'}: {(ev.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(ev.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
