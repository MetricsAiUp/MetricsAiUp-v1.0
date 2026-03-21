import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function Analytics() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('24h');

  useEffect(() => {
    api.get(`/api/dashboard/metrics?period=${period}`)
      .then(res => setMetrics(res.data))
      .catch(console.error);
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('nav.analytics')}
        </h2>
        <div className="flex gap-2">
          {['24h', '7d', '30d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{
                background: period === p ? 'var(--accent)' : 'var(--bg-glass)',
                color: period === p ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border-glass)'}`,
              }}
            >
              {t(`common.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Zone metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('dashboard.zoneLoad')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics?.zoneMetrics?.map(zm => (
            <div key={zm.zoneId} className="glass p-4">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                {zm.zoneId}
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Визитов</span>
                  <span style={{ color: 'var(--text-primary)' }}>{zm._count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Ср. время</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {zm._avg?.duration ? `${Math.round(zm._avg.duration / 60)} мин` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {(!metrics?.zoneMetrics || metrics.zoneMetrics.length === 0) && (
            <div className="glass p-4 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('common.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Work order metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('workOrders.title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metrics?.workOrderMetrics?.map(wm => (
            <div key={wm.status} className="glass p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{wm._count}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {t(`workOrders.${wm.status}`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
