import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, ChevronDown } from 'lucide-react';

export default function LocationSwitcher() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [locations, setLocations] = useState([]);
  const [current, setCurrent] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/api/locations?active=true')
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          setLocations(data);
          const saved = localStorage.getItem('currentLocationId');
          const found = data.find(l => l.id === saved);
          setCurrent(found || data[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (locations.length <= 1) return null;

  const handleSelect = (loc) => {
    setCurrent(loc);
    localStorage.setItem('currentLocationId', loc.id);
    setOpen(false);
    window.dispatchEvent(new CustomEvent('locationChanged', { detail: loc }));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
      >
        <MapPin size={12} style={{ color: 'var(--accent)' }} />
        <span className="max-w-[100px] truncate">{current?.name || t('location.switch')}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 p-1 rounded-lg shadow-lg z-30"
          style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border-glass)', minWidth: 160 }}>
          {locations.map(loc => (
            <button key={loc.id}
              onClick={() => handleSelect(loc)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left hover:opacity-80"
              style={{
                color: loc.id === current?.id ? 'var(--accent)' : 'var(--text-secondary)',
                background: loc.id === current?.id ? 'var(--accent-light)' : 'transparent',
              }}>
              <MapPin size={12} />
              <div>
                <div className="font-medium">{loc.name}</div>
                {loc.address && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{loc.address}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
