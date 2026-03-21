import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/useSocket';

export default function Events() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('nav.events')}
        </h2>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {total} {t('nav.events').toLowerCase()}
        </span>
      </div>

      <div className="glass-static overflow-hidden">
        <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
          {events.map(ev => (
            <div key={ev.id} className="px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  {ev.type.replace(/_/g, ' ')}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {ev.zone?.name}
                </span>
                {ev.post && (
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    → {ev.post.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  conf: {(ev.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(ev.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('common.noData')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
