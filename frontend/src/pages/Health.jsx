import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, Database, HardDrive, Camera, RefreshCw,
  Wifi, WifiOff, Server, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function ProgressBar({ percent, height = 6 }) {
  const color = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#10b981';
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--bg-glass)' }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
    </div>
  );
}

export default function Health() {
  const { i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchHealth = useCallback(async () => {
    setSpinning(true);
    try {
      const res = await api.get('/api/system-health');
      setData(res?.data || res);
      setLastUpdate(new Date());
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
        <RefreshCw size={18} className="animate-spin mr-2" /> {isRu ? 'Загрузка...' : 'Loading...'}
      </div>
    );
  }

  const mem = data?.backend?.memoryUsage;
  const rssMB = mem ? +(mem.rss / 1024 / 1024).toFixed(0) : 0;
  const heapUsedMB = mem ? +(mem.heapUsed / 1024 / 1024).toFixed(0) : 0;
  const heapTotalMB = mem ? +(mem.heapTotal / 1024 / 1024).toFixed(0) : 1;
  const heapPercent = Math.round((heapUsedMB / heapTotalMB) * 100);
  const backendOk = data?.backend?.status === 'ok';
  const dbOk = data?.database?.status === 'ok';
  const cameras = Array.isArray(data?.cameras) ? data.cameras : [];
  const onlineCams = cameras.filter(c => c.online).length;
  const totalCams = cameras.length;
  const diskPercent = data?.disk?.usagePercent || 0;
  const diskUsedGB = data?.disk?.usedBytes ? +(data.disk.usedBytes / 1073741824).toFixed(1) : 0;
  const diskTotalGB = data?.disk?.totalBytes ? +(data.disk.totalBytes / 1073741824).toFixed(0) : 0;
  const diskFreeGB = data?.disk?.availableBytes ? +(data.disk.availableBytes / 1073741824).toFixed(1) : 0;

  // Overall health score
  const checks = [backendOk, dbOk, diskPercent < 90];
  const healthyCount = checks.filter(Boolean).length;
  const allHealthy = healthyCount === checks.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: allHealthy ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
            {allHealthy
              ? <CheckCircle size={20} style={{ color: '#10b981' }} />
              : <AlertCircle size={20} style={{ color: '#ef4444' }} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Состояние системы' : 'System Status'}
              </h2>
              <HelpButton pageKey="health" />
            </div>
            <p className="text-[11px]" style={{ color: allHealthy ? '#10b981' : '#f59e0b' }}>
              {allHealthy
                ? (isRu ? 'Все системы работают нормально' : 'All systems operational')
                : (isRu ? `${healthyCount} из ${checks.length} систем в норме` : `${healthyCount} of ${checks.length} systems OK`)
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {lastUpdate.toLocaleTimeString(isRu ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={fetchHealth}
            className="p-1.5 rounded-lg hover:opacity-80 transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-glass)' }}>
            <RefreshCw size={14} className={spinning ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Service status cards - horizontal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Backend */}
        <ServiceCard
          icon={Server}
          title={isRu ? 'Сервер' : 'Server'}
          ok={backendOk}
          statusText={backendOk ? 'Online' : 'Offline'}
          details={[
            { label: isRu ? 'Работает' : 'Uptime', value: data?.backend?.uptime ? formatUptime(data.backend.uptime) : '—' },
            { label: 'Node.js', value: data?.backend?.nodeVersion || '—' },
          ]}
        />
        {/* Database */}
        <ServiceCard
          icon={Database}
          title={isRu ? 'База данных' : 'Database'}
          ok={dbOk}
          statusText={dbOk ? `${data.database.pingMs}ms` : (isRu ? 'Ошибка' : 'Error')}
          details={dbOk ? [
            { label: isRu ? 'Задержка' : 'Latency', value: `${data.database.pingMs} мс`, color: data.database.pingMs < 5 ? '#10b981' : data.database.pingMs < 20 ? '#f59e0b' : '#ef4444' },
            { label: isRu ? 'Размер' : 'Size', value: `${data.database.sizeMB} МБ` },
          ] : [
            { label: isRu ? 'Ошибка' : 'Error', value: data?.database?.error || '—', color: '#ef4444' },
          ]}
        />
        {/* 1C Sync */}
        <ServiceCard
          icon={RefreshCw}
          title={isRu ? 'Синхронизация 1С' : '1C Sync'}
          ok={data?.sync1c?.status === 'success'}
          statusText={data?.sync1c?.status === 'success' ? 'OK' : (data?.sync1c?.status === 'never' ? (isRu ? 'Не было' : 'Never') : (isRu ? 'Ошибка' : 'Error'))}
          details={[
            {
              label: isRu ? 'Последняя' : 'Last sync',
              value: data?.sync1c?.lastSyncAt
                ? new Date(data.sync1c.lastSyncAt).toLocaleString(isRu ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—',
            },
            ...(data?.sync1c?.records != null ? [{ label: isRu ? 'Записей' : 'Records', value: String(data.sync1c.records) }] : []),
          ]}
        />
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Memory */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={15} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Память' : 'Memory'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Heap</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{heapUsedMB} / {heapTotalMB} МБ</span>
              </div>
              <ProgressBar percent={heapPercent} />
            </div>
            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>RSS ({isRu ? 'общая' : 'total'})</span>
              <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{rssMB} МБ</span>
            </div>
          </div>
        </div>

        {/* Disk */}
        <div className="glass p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <HardDrive size={15} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isRu ? 'Хранилище' : 'Storage'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isRu ? 'Занято' : 'Used'} {diskUsedGB} {isRu ? 'из' : 'of'} {diskTotalGB} ГБ
                </span>
                <span className="text-xs font-mono font-medium" style={{
                  color: diskPercent > 90 ? '#ef4444' : diskPercent > 70 ? '#f59e0b' : '#10b981'
                }}>{diskPercent}%</span>
              </div>
              <ProgressBar percent={diskPercent} height={8} />
            </div>
            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Свободно' : 'Free'}</span>
              <span className="text-xs font-mono font-medium" style={{ color: '#10b981' }}>{diskFreeGB} ГБ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cameras */}
      {totalCams > 0 && (
        <div className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera size={15} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isRu ? 'Камеры' : 'Cameras'}
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: onlineCams === totalCams ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: onlineCams === totalCams ? '#10b981' : '#ef4444',
            }}>
              {onlineCams} / {totalCams} {isRu ? 'онлайн' : 'online'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {cameras.map(cam => {
              const name = cam.id.replace(/^cam/, 'CAM ').replace(/^CAM 0/, 'CAM ');
              return (
                <div key={cam.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: cam.online ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)',
                    border: `1px solid ${cam.online ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.15)'}`,
                  }}>
                  {cam.online
                    ? <Wifi size={12} style={{ color: '#10b981' }} />
                    : <WifiOff size={12} style={{ color: 'var(--text-muted)' }} />
                  }
                  <span className="font-medium" style={{ color: cam.online ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Service status card component */
function ServiceCard({ icon: Icon, title, ok, statusText, details }) {
  return (
    <div className="glass p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
            <Icon size={14} style={{ color: ok ? '#10b981' : '#ef4444' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <span className="text-xs font-bold" style={{ color: ok ? '#10b981' : '#ef4444' }}>{statusText}</span>
      </div>
      {details.length > 0 && (
        <div className="space-y-0.5 pt-1" style={{ borderTop: '1px solid var(--border-glass)' }}>
          {details.map((d, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
              <span className="text-[11px] font-mono" style={{ color: d.color || 'var(--text-secondary)' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
