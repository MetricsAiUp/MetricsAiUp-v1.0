import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Clock, BarChart3, RefreshCw } from 'lucide-react';

// Use backend /api/predict endpoints (proxied by nginx alongside other /api/* routes)
const ML_API = import.meta.env.VITE_ML_API_URL || `${window.location.origin}/api`;

export default function PredictionWidget() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const [forecast, setForecast] = useState(null);
  const [freePosts, setFreePosts] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const [loadRes, freeRes] = await Promise.all([
        fetch(`${ML_API}/predict/load`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${ML_API}/predict/free`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (loadRes) setForecast(loadRes);
      if (freeRes) setFreePosts(freeRes);
    } catch { /* ML service may not be running */ }
    setLoading(false);
  };

  useEffect(() => { fetchPredictions(); }, []);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('predict.title')}
          </span>
        </div>
        <div className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
          {isRu ? 'Загрузка прогноза...' : 'Loading forecast...'}
        </div>
      </div>
    );
  }

  if (!forecast && !freePosts) {
    return (
      <div className="glass rounded-xl p-4" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={18} style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('predict.title')}
          </span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isRu ? 'ML-сервис недоступен. Запустите: python ml/predict_api.py' : 'ML service unavailable. Run: python ml/predict_api.py'}
        </div>
      </div>
    );
  }

  const currentHour = new Date().getHours();
  const currentLoad = forecast?.hourly?.find(h => h.hour === currentHour);
  const peakHour = forecast?.hourly ? forecast.hourly.reduce((max, h) => h.avg > max.avg ? h : max, forecast.hourly[0]) : null;

  return (
    <div className="glass rounded-xl p-4" style={{ border: '1px solid var(--border-glass)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('predict.loadForecast')}
          </span>
        </div>
        <button onClick={fetchPredictions}
          className="p-1 rounded hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Current load */}
      {currentLoad && (
        <div className="flex items-center gap-3 mb-3">
          <div className="text-2xl font-bold" style={{ color: currentLoad.avg > 0.7 ? 'var(--danger)' : currentLoad.avg > 0.4 ? 'var(--warning)' : 'var(--success)' }}>
            {Math.round(currentLoad.avg * 100)}%
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Текущая загрузка' : 'Current load'}
            </div>
            {peakHour && (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {isRu ? `Пик: ${peakHour.hour}:00 (${Math.round(peakHour.avg * 100)}%)` : `Peak: ${peakHour.hour}:00 (${Math.round(peakHour.avg * 100)}%)`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hourly mini-chart */}
      {forecast?.hourly && (
        <div className="flex gap-0.5 mb-3" style={{ height: 32 }}>
          {forecast.hourly.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col justify-end" title={`${h.hour}:00 — ${Math.round(h.avg * 100)}%`}>
              <div
                className="rounded-t"
                style={{
                  height: `${Math.max(2, h.avg * 100)}%`,
                  background: h.hour === currentHour ? 'var(--accent)' : h.avg > 0.7 ? 'var(--danger)' : h.avg > 0.4 ? 'var(--warning)' : 'var(--success)',
                  opacity: h.hour === currentHour ? 1 : 0.5,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Free posts predictions */}
      {freePosts?.predictions && (
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            {t('predict.freeIn')}
          </div>
          <div className="flex flex-wrap gap-1">
            {freePosts.predictions.filter(p => p.status === 'occupied' && p.free_in_minutes != null).map(p => (
              <div key={p.post}
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  background: p.free_in_minutes <= 15 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: p.free_in_minutes <= 15 ? 'var(--success)' : 'var(--warning)',
                }}>
                {isRu ? `П${p.post}` : `P${p.post}`}: {p.free_in_minutes}{isRu ? 'м' : 'm'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
