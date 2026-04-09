import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Database, HardDrive, Camera, RefreshCw } from 'lucide-react';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ ok }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: ok ? '#10b981' : '#ef4444' }}
    />
  );
}

export default function Health() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.get('/api/system-health');
      setData(res?.data || res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Admin-only check
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {isRu ? 'Доступ запрещён' : 'Access denied'}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </div>
    );
  }

  const mem = data?.backend?.memoryUsage;
  const rssMB = mem ? (mem.rss / 1024 / 1024).toFixed(1) : '---';
  const heapMB = mem ? (mem.heapUsed / 1024 / 1024).toFixed(1) : '---';

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Activity size={20} style={{ color: 'var(--accent)' }} />
            {t('health.title')}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('health.autoRefresh')}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {t('health.error')}: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Backend card */}
        <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('health.backend')}</span>
            <StatusDot ok={data?.backend?.status === 'ok'} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{t('health.uptime')}</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data?.backend?.uptime ? formatUptime(data.backend.uptime) : '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Version</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data?.backend?.version || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Node.js</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data?.backend?.nodeVersion || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>RSS</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{rssMB} MB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Heap</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{heapMB} MB</span>
            </div>
          </div>
        </div>

        {/* Database card */}
        <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('health.database')}</span>
            <StatusDot ok={data?.database?.status === 'ok'} />
          </div>
          {data?.database?.status === 'ok' ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{t('health.ping')}</span>
                <span className="font-mono" style={{ color: data.database.pingMs < 10 ? '#10b981' : data.database.pingMs < 50 ? '#f59e0b' : '#ef4444' }}>
                  {data.database.pingMs}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{t('health.size')}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data.database.sizeMB} MB</span>
              </div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: '#ef4444' }}>{data?.database?.error || t('health.error')}</div>
          )}
        </div>

        {/* Cameras card */}
        <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Camera size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('health.cameras')}</span>
          </div>
          {Array.isArray(data?.cameras) ? (
            <div className="space-y-1.5">
              {data.cameras.map(cam => (
                <div key={cam.id} className="flex items-center gap-2 text-sm">
                  <StatusDot ok={cam.online} />
                  <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{cam.id}</span>
                  <span className="text-xs" style={{ color: cam.online ? '#10b981' : '#ef4444' }}>
                    {cam.online ? t('health.online') : t('health.offline')}
                  </span>
                </div>
              ))}
              {data.cameras.length === 0 && (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</div>
              )}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</div>
          )}
        </div>

        {/* 1C Sync card */}
        <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('health.sync1c')}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{t('health.lastSync')}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                {data?.sync1c?.lastSyncAt
                  ? new Date(data.sync1c.lastSyncAt).toLocaleString(isRu ? 'ru-RU' : 'en-US')
                  : t('health.never')
                }
              </span>
            </div>
            {data?.sync1c?.status && data.sync1c.status !== 'never' && (
              <>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Статус' : 'Status'}</span>
                  <StatusDot ok={data.sync1c.status === 'success'} />
                </div>
                {data.sync1c.records != null && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Записей' : 'Records'}</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{data.sync1c.records}</span>
                  </div>
                )}
                {data.sync1c.errors > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Ошибок' : 'Errors'}</span>
                    <span className="font-mono" style={{ color: '#ef4444' }}>{data.sync1c.errors}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Disk card */}
        <div className="glass-static rounded-2xl p-5" style={{ border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center gap-2 mb-4">
            <HardDrive size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('health.disk')}</span>
          </div>
          {data?.disk?.usagePercent != null ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{t('health.used')}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {((data.disk.usedBytes || 0) / 1073741824).toFixed(1)} GB
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{t('health.available')}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {((data.disk.availableBytes || 0) / 1073741824).toFixed(1)} GB
                </span>
              </div>
              {/* Progress bar */}
              <div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-glass)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${data.disk.usagePercent}%`,
                      background: data.disk.usagePercent > 90 ? '#ef4444' : data.disk.usagePercent > 70 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
                <div className="text-xs text-right mt-1" style={{ color: 'var(--text-muted)' }}>
                  {data.disk.usagePercent}%
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.noData')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
