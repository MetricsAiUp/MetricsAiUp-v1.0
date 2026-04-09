import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Database, HardDrive, Camera, RefreshCw, Wifi, WifiOff, Clock, Server, CircuitBoard } from 'lucide-react';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function StatusBadge({ ok, label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ok ? '#10b981' : '#ef4444' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#10b981' : '#ef4444' }} />
      {label}
    </span>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xs font-mono font-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function ProgressBar({ percent, size = 'sm' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#10b981';
  return (
    <div className={`${h} w-full rounded-full overflow-hidden`} style={{ background: 'var(--bg-glass)' }}>
      <div className={`${h} rounded-full transition-all duration-500`} style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export default function Health() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);

  const fetchHealth = useCallback(async () => {
    setSpinning(true);
    try {
      const res = await api.get('/api/system-health');
      setData(res?.data || res);
    } catch { /* ignore */ }
    finally { setLoading(false); setTimeout(() => setSpinning(false), 600); }
  }, [api]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

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
        <RefreshCw size={20} className="animate-spin mr-2" /> {t('common.loading')}
      </div>
    );
  }

  const mem = data?.backend?.memoryUsage;
  const rssMB = mem ? (mem.rss / 1024 / 1024).toFixed(0) : '—';
  const heapMB = mem ? (mem.heapUsed / 1024 / 1024).toFixed(0) : '—';
  const heapTotal = mem ? (mem.heapTotal / 1024 / 1024).toFixed(0) : 0;
  const heapPercent = heapTotal > 0 ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;
  const backendOk = data?.backend?.status === 'ok';
  const dbOk = data?.database?.status === 'ok';
  const onlineCams = Array.isArray(data?.cameras) ? data.cameras.filter(c => c.online).length : 0;
  const totalCams = Array.isArray(data?.cameras) ? data.cameras.length : 0;
  const diskPercent = data?.disk?.usagePercent || 0;
  const diskUsed = data?.disk?.usedBytes ? (data.disk.usedBytes / 1073741824).toFixed(1) : '—';
  const diskTotal = data?.disk?.totalBytes ? (data.disk.totalBytes / 1073741824).toFixed(0) : '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Мониторинг системы' : 'System Monitor'}
          </h2>
        </div>
        <button onClick={fetchHealth}
          className="p-2 rounded-lg hover:opacity-80 transition-all"
          style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={16} className={spinning ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Top row — main status indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="glass px-3 py-2 flex items-center gap-2">
          <Server size={14} style={{ color: backendOk ? '#10b981' : '#ef4444' }} />
          <span className="text-sm font-bold" style={{ color: backendOk ? '#10b981' : '#ef4444' }}>
            {backendOk ? 'Online' : 'Offline'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {data?.backend?.uptime ? formatUptime(data.backend.uptime) : ''}
          </span>
        </div>
        <div className="glass px-3 py-2 flex items-center gap-2">
          <Database size={14} style={{ color: dbOk ? '#10b981' : '#ef4444' }} />
          <span className="text-sm font-bold" style={{ color: dbOk ? '#10b981' : '#ef4444' }}>
            {dbOk ? `${data.database.pingMs}ms` : 'Error'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dbOk ? `${data.database.sizeMB} MB` : ''}</span>
        </div>
        <div className="glass px-3 py-2 flex items-center gap-2">
          <Camera size={14} style={{ color: onlineCams > 0 ? '#10b981' : 'var(--text-muted)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{onlineCams}/{totalCams}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'камер' : 'cameras'}</span>
        </div>
        <div className="glass px-3 py-2 flex items-center gap-2">
          <HardDrive size={14} style={{ color: diskPercent > 90 ? '#ef4444' : diskPercent > 70 ? '#f59e0b' : '#10b981' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{diskPercent}%</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{diskUsed}/{diskTotal} GB</span>
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Backend + Memory */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Бэкенд' : 'Backend'}
              </span>
            </div>
            <StatusBadge ok={backendOk} label={backendOk ? 'OK' : 'Error'} />
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
            <MetricRow label={isRu ? 'Аптайм' : 'Uptime'} value={data?.backend?.uptime ? formatUptime(data.backend.uptime) : '—'} />
            <MetricRow label="Node.js" value={data?.backend?.nodeVersion || '—'} />
            <MetricRow label="RSS" value={`${rssMB} MB`} />
            <MetricRow label="Heap" value={`${heapMB} / ${heapTotal} MB`} />
          </div>
          <ProgressBar percent={heapPercent} />
          <div className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
            Heap: {heapPercent}%
          </div>
        </div>

        {/* Cameras */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Камеры' : 'Cameras'}
              </span>
            </div>
            <StatusBadge ok={onlineCams === totalCams && totalCams > 0} label={`${onlineCams}/${totalCams}`} />
          </div>
          {totalCams > 0 ? (
            <div className="grid grid-cols-2 gap-1.5">
              {data.cameras.map(cam => (
                <div key={cam.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                  style={{ background: cam.online ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)' }}>
                  {cam.online ? <Wifi size={11} style={{ color: '#10b981' }} /> : <WifiOff size={11} style={{ color: '#ef4444' }} />}
                  <span style={{ color: cam.online ? '#10b981' : 'var(--text-muted)' }}>{cam.id}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Нет данных' : 'No data'}</div>
          )}
        </div>

        {/* Disk */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Диск' : 'Disk'}
              </span>
            </div>
            <StatusBadge ok={diskPercent < 80} label={`${diskPercent}%`} />
          </div>
          <ProgressBar percent={diskPercent} size="lg" />
          <div className="flex items-center justify-between">
            <MetricRow label={isRu ? 'Использовано' : 'Used'} value={`${diskUsed} GB`} />
            <MetricRow label={isRu ? 'Всего' : 'Total'} value={`${diskTotal} GB`} />
          </div>
        </div>

        {/* 1C Sync */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Синхронизация 1С' : '1C Sync'}
              </span>
            </div>
            {data?.sync1c?.status && data.sync1c.status !== 'never' ? (
              <StatusBadge ok={data.sync1c.status === 'success'} label={data.sync1c.status === 'success' ? 'OK' : 'Error'} />
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Никогда' : 'Never'}</span>
            )}
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
            <MetricRow
              label={isRu ? 'Последняя синхронизация' : 'Last sync'}
              value={data?.sync1c?.lastSyncAt
                ? new Date(data.sync1c.lastSyncAt).toLocaleString(isRu ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—'}
            />
            {data?.sync1c?.records != null && (
              <MetricRow label={isRu ? 'Записей' : 'Records'} value={data.sync1c.records} />
            )}
            {data?.sync1c?.errors > 0 && (
              <MetricRow label={isRu ? 'Ошибок' : 'Errors'} value={data.sync1c.errors} color="#ef4444" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
