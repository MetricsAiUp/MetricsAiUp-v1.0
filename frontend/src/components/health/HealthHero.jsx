import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { LEVEL_COLOR, LEVEL_BG, scoreLevel, formatUptime } from './healthUtils';

// Hero-блок: круговой индикатор Score + название уровня + ключевые KPI.
// Score рассчитывается на бэкенде (/api/system-health → verdict.score).
export default function HealthHero({ snapshot, lastUpdate, onRefresh, refreshing }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  const score = snapshot?.verdict?.score ?? 0;
  const level = snapshot?.verdict?.level || scoreLevel(score);
  const failures = snapshot?.verdict?.failures || [];
  const color = LEVEL_COLOR[level];
  const bg = LEVEL_BG[level];

  const Icon = level === 'ok' ? CheckCircle : level === 'warn' ? AlertTriangle : AlertCircle;

  // SVG-кольцо
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="glass p-4 lg:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Score ring */}
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 110, height: 110 }}>
          <svg width="110" height="110" viewBox="0 0 140 140" className="transform -rotate-90">
            <circle cx="70" cy="70" r={radius} stroke="var(--border-glass)" strokeWidth="10" fill="none" />
            <circle
              cx="70" cy="70" r={radius}
              stroke={color} strokeWidth="10" fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <div className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</div>
            <div className="text-[10px] mt-1 tabular-nums" style={{ color: 'var(--text-muted)' }}>
              / 100
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t(`health.level.${level}`)}
            </h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {failures.length === 0
              ? t('health.noFailures')
              : isRu
                ? `Активных проблем: ${failures.length}`
                : `Active issues: ${failures.length}`}
          </p>

          {failures.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {failures.slice(0, 6).map(f => (
                <span key={f}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: bg, color }}>
                  {t(`health.failures.${f}`, f.replace(/_/g, ' '))}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:flex lg:gap-5">
          <KpiItem
            label={t('health.uptime')}
            value={formatUptime(snapshot?.backend?.uptime, isRu)}
          />
          <KpiItem
            label={t('health.metrics.eventsLast5m')}
            value={snapshot?.pulse?.eventsLast5m ?? 0}
          />
          <KpiItem
            label={t('health.cameras.online')}
            value={`${snapshot?.cameras?.online ?? 0}/${snapshot?.cameras?.total ?? 0}`}
          />
          <KpiItem
            label={t('health.internal.expiresIn')}
            value={snapshot?.ssl?.daysLeft != null ? `${snapshot.ssl.daysLeft} ${t('health.units.days')}` : '—'}
            tone={snapshot?.ssl?.daysLeft != null && snapshot.ssl.daysLeft < 30 ? 'warn' : 'ok'}
          />
        </div>

        {/* Refresh */}
        <div className="flex flex-col items-end gap-2 lg:ml-auto">
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {lastUpdate.toLocaleTimeString(isRu ? 'ru-RU' : 'en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </span>
          )}
          <button onClick={onRefresh}
            className="p-2 rounded-lg hover:opacity-80 transition-all"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-glass)' }}
            title={t('health.refresh')}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiItem({ label, value, tone }) {
  const color = tone === 'warn' ? '#f59e0b' : tone === 'critical' ? '#ef4444' : 'var(--text-primary)';
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums truncate" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
