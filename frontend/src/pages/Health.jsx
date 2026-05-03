import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, Database, HardDrive, Camera, RefreshCw, Server, Eye, Brain,
  Video, Send, Cpu, MemoryStick, Lock, ShieldCheck, Wifi, WifiOff, Bell,
} from 'lucide-react';
import HelpButton from '../components/HelpButton';
import { EVENT_TYPES } from '../constants';
import HealthHero from '../components/health/HealthHero';
import DataSourceCard from '../components/health/DataSourceCard';
import ResourceBar from '../components/health/ResourceBar';
import ServiceRow from '../components/health/ServiceRow';
import StatusBadge from '../components/health/StatusBadge';
import MetricRow from '../components/health/MetricRow';
import {
  formatBytes, formatUptime, formatAge, statusToLevel,
  LEVEL_COLOR, pctToLevel,
} from '../components/health/healthUtils';

// Новая Health-страница (v2): подаёт расширенный snapshot из /api/system-health
// с verdict.score, dataSources (CV/ML/HLS/Telegram), pulse, security и фоновыми сервисами.
export default function Health() {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';
  const { user, api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async (fresh = false) => {
    setRefreshing(true);
    try {
      const res = await api.get(`/api/system-health${fresh ? '?fresh=1' : ''}`);
      setData(res?.data || res);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err?.message || 'load_error');
    } finally {
      setLoading(false);
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [api]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 30000);
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
        <RefreshCw size={18} className="animate-spin mr-2" /> {t('health.loading')}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--text-muted)' }}>
        <span>{t('health.loadError')}</span>
        {error && <span className="text-[10px] font-mono">{error}</span>}
        <button onClick={() => fetchHealth(true)}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'var(--bg-glass)', color: 'var(--text-primary)' }}>
          {t('health.refresh')}
        </button>
      </div>
    );
  }

  const ds = data.dataSources || {};
  const pulse = data.pulse || {};
  const resources = data.resources || {};
  const security = data.security || {};
  const services = data.services || [];
  const cameras = data.cameras || { list: [], online: 0, total: 0 };

  // Memory
  const totalMem = resources.totalMemBytes || 1;
  const freeMem = resources.freeMemBytes || 0;
  const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

  const heapPct = data.backend?.heapPercent ?? 0;
  const diskPct = data.disk?.usagePercent ?? 0;

  const cpuLoad = resources.loadavg?.[0] || 0;
  const cpuCount = resources.cpuCount || 1;
  const cpuPct = Math.round((cpuLoad / cpuCount) * 100);

  return (
    <div className="space-y-3">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('health.title')}
          </h1>
          <HelpButton pageKey="health" />
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {t('health.autoRefresh')}
        </span>
      </div>

      {/* Hero */}
      <HealthHero
        snapshot={data}
        lastUpdate={lastUpdate}
        onRefresh={() => fetchHealth(true)}
        refreshing={refreshing}
      />

      {/* Data Sources — 4 source cards */}
      <Section title={t('health.sections.dataSources')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <DataSourceCard
            icon={Eye}
            title={t('health.dataSources.cvApi')}
            desc={t('health.dataSources.cvApiDesc')}
            source={ds.cvApi}
          />
          <DataSourceCard
            icon={Brain}
            title={t('health.dataSources.mlApi')}
            desc={t('health.dataSources.mlApiDesc')}
            source={ds.mlApi}
          />
          <DataSourceCard
            icon={Video}
            title={t('health.dataSources.hls')}
            desc={t('health.dataSources.hlsDesc')}
            source={ds.hls}
          />
          <DataSourceCard
            icon={Send}
            title={t('health.dataSources.telegram')}
            desc={t('health.dataSources.telegramDesc')}
            source={ds.telegram}
          />
        </div>
      </Section>

      {/* Pulse — полноширинный ряд 8 KPI */}
      <Section title={t('health.sections.pulse')}>
        <div className="glass p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <PulseStat
              label={t('health.metrics.lastEvent')}
              value={formatAge(pulse.lastEventAgeSec, t)}
              hint={pulse.lastEventType
                ? EVENT_TYPES[pulse.lastEventType]?.[isRu ? 'ru' : 'en'] || pulse.lastEventType
                : null}
              tone={pulse.lastEventAgeSec != null && pulse.lastEventAgeSec > 600 ? 'critical' : 'ok'}
            />
            <PulseStat label={t('health.metrics.eventsLast5m')} value={pulse.eventsLast5m ?? 0} />
            <PulseStat label={t('health.metrics.eventsLast1h')} value={pulse.eventsLast1h ?? 0} />
            <PulseStat label={t('health.metrics.eventsLast24h')} value={pulse.eventsLast24h ?? 0} />
            <PulseStat label={t('health.metrics.snapshotsLast24h')} value={pulse.snapshotsLast24h ?? 0} />
            <PulseStat label={t('health.metrics.sessionsLast24h')} value={pulse.sessionsLast24h ?? 0} />
            <PulseStat label={t('health.metrics.activeRecommendations')} value={pulse.activeRecommendations ?? 0} />
            <PulseStat label={t('health.metrics.auditLast24h')} value={pulse.auditEntriesLast24h ?? 0} />
          </div>
        </div>
      </Section>

      {/* Resources — полноширинный ряд 4 баров */}
      <Section title={t('health.sections.resources')}>
        <div className="glass p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-2.5">
          <ResourceBar
            label={t('health.resources.heap')}
            percent={heapPct}
            hint={data.backend?.memoryUsage
              ? `${(data.backend.memoryUsage.heapUsed / 1048576).toFixed(0)} / ${(data.backend.memoryUsage.heapTotal / 1048576).toFixed(0)} ${isRu ? 'МБ' : 'MB'}`
              : null}
          />
          <ResourceBar
            label={t('health.resources.memory')}
            percent={usedMemPct}
            hint={`${formatBytes(totalMem - freeMem)} / ${formatBytes(totalMem)}`}
          />
          <ResourceBar
            label={t('health.resources.disk')}
            percent={diskPct}
            hint={data.disk
              ? `${formatBytes(data.disk.usedBytes)} / ${formatBytes(data.disk.totalBytes)}`
              : null}
          />
          <ResourceBar
            label={t('health.resources.cpu')}
            percent={cpuPct}
            hint={`${(resources.loadavg || []).join(' / ')} · ${cpuCount} ${isRu ? 'ядер' : 'cores'}`}
          />
        </div>
      </Section>

      {/* Internal services row: backend / db / 1c / ssl */}
      <Section title={t('health.sections.services')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <InternalServiceCard
            icon={Server}
            title={t('health.internal.backend')}
            level={statusToLevel(data.backend?.status)}
            statusLabel={t(`health.status.${data.backend?.status || 'unknown'}`, data.backend?.status)}
            rows={[
              { label: t('health.uptime'), value: formatUptime(data.backend?.uptime, isRu) },
              { label: t('health.internal.nodeVersion'), value: data.backend?.nodeVersion || '—' },
              { label: t('health.internal.pid'), value: data.backend?.pid || '—' },
            ]}
          />
          <InternalServiceCard
            icon={Database}
            title={t('health.internal.database')}
            level={statusToLevel(data.database?.status)}
            statusLabel={t(`health.status.${data.database?.status || 'unknown'}`, data.database?.status)}
            rows={[
              { label: t('health.ping'), value: data.database?.pingMs != null ? `${data.database.pingMs} ${t('health.units.ms')}` : '—' },
              { label: t('health.size'), value: data.database?.sizeMB != null ? `${data.database.sizeMB} ${isRu ? 'МБ' : 'MB'}` : '—' },
              ...(data.database?.error ? [{ label: t('health.error'), value: data.database.error, color: '#ef4444' }] : []),
            ]}
          />
          <InternalServiceCard
            icon={RefreshCw}
            title={t('health.internal.sync1c')}
            level={statusToLevel(data.sync1c?.status)}
            statusLabel={t(`health.status.${data.sync1c?.status || 'unknown'}`, data.sync1c?.status)}
            rows={[
              {
                label: t('health.lastSync'),
                value: data.sync1c?.lastSyncAt
                  ? new Date(data.sync1c.lastSyncAt).toLocaleString(isRu ? 'ru-RU' : 'en-US', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })
                  : '—',
              },
              ...(data.sync1c?.ageHours != null
                ? [{
                    label: isRu ? 'Возраст' : 'Age',
                    value: `${data.sync1c.ageHours} ${t('health.units.hours')}`,
                    color: data.sync1c.ageHours > 24 ? '#f59e0b' : undefined,
                  }]
                : []),
              ...(data.sync1c?.records != null
                ? [{ label: isRu ? 'Записей' : 'Records', value: String(data.sync1c.records) }]
                : []),
            ]}
          />
          <InternalServiceCard
            icon={Lock}
            title={t('health.internal.ssl')}
            level={
              data.ssl?.daysLeft == null ? 'warn'
              : data.ssl.daysLeft < 7 ? 'critical'
              : data.ssl.daysLeft < 30 ? 'warn' : 'ok'
            }
            statusLabel={data.ssl?.daysLeft != null ? `${data.ssl.daysLeft} ${t('health.units.days')}` : t('health.unknown')}
            rows={[
              ...(data.ssl?.expiresAt
                ? [{
                    label: t('health.internal.expiresIn'),
                    value: new Date(data.ssl.expiresAt).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    }),
                  }]
                : []),
            ]}
          />
        </div>
      </Section>

      {/* Background services — компактные плитки */}
      {services.length > 0 && (
        <Section title={t('health.sections.backgroundServices')}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {services.map(svc => <ServiceRow key={svc.name} service={svc} />)}
          </div>
        </Section>
      )}

      {/* Security + Cameras (1:2 — камер больше места) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Section title={t('health.sections.security')}>
          <div className="glass p-3 space-y-1.5">
            <MetricRow
              label={t('health.security.failedLogins')}
              value={security.failedLogins24h ?? 0}
              color={security.failedLogins24h > 5 ? '#f59e0b' : undefined}
            />
            <MetricRow
              label={t('health.security.auditEntries')}
              value={security.auditEntries24h ?? 0}
            />
            <MetricRow
              label={t('health.security.pushSubscriptions')}
              value={security.pushSubscriptions ?? 0}
            />
          </div>
        </Section>

        <Section title={t('health.sections.cameras')} className="lg:col-span-2">
          <div className="glass p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('health.cameras.online')} / {t('health.cameras.total')}
                </span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: cameras.online === cameras.total ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: cameras.online === cameras.total ? '#10b981' : '#f59e0b',
                }}>
                {cameras.online} / {cameras.total}
              </span>
            </div>
            {cameras.list.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                {cameras.list.map(cam => {
                  const name = cam.id.replace(/^cam0?/i, '');
                  return (
                    <div key={cam.id}
                      className="flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px]"
                      style={{
                        background: cam.online ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)',
                        border: `1px solid ${cam.online ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.15)'}`,
                      }}
                      title={cam.id}>
                      {cam.online
                        ? <Wifi size={9} style={{ color: '#10b981' }} />
                        : <WifiOff size={9} style={{ color: 'var(--text-muted)' }} />}
                      <span className="font-mono font-medium tabular-nums"
                        style={{ color: cam.online ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

// --- helpers ---

function Section({ title, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-[11px] font-bold uppercase tracking-wider px-1"
        style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function PulseStat({ label, value, hint, tone }) {
  const color = tone === 'critical' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : 'var(--text-primary)';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums truncate" style={{ color }}>{value}</div>
      {hint && (
        <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{hint}</div>
      )}
    </div>
  );
}

function InternalServiceCard({ icon: Icon, title, level, statusLabel, rows = [] }) {
  const color = LEVEL_COLOR[level];
  const bg = level === 'ok'
    ? 'rgba(16,185,129,0.1)'
    : level === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  return (
    <div className="glass p-2.5 space-y-1.5 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded" style={{ background: bg }}>
            <Icon size={13} style={{ color }} />
          </div>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
        </div>
        <StatusBadge level={level} label={statusLabel} status={level} />
      </div>
      {rows.length > 0 && (
        <div className="space-y-0.5 pt-1.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          {rows.map((r, i) => <MetricRow key={i} label={r.label} value={r.value} color={r.color} />)}
        </div>
      )}
    </div>
  );
}
