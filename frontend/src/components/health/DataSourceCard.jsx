import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import MetricRow from './MetricRow';
import { formatAge, statusToLevel, LEVEL_COLOR } from './healthUtils';

// Карточка одного внешнего источника (CV/ML/HLS/Telegram).
export default function DataSourceCard({ icon: Icon, title, desc, source, metrics = [] }) {
  const { t } = useTranslation();
  if (!source) return null;

  const allMetrics = [
    ...(source.latencyMs != null
      ? [{ label: t('health.metrics.latency'), value: `${source.latencyMs} ${t('health.units.ms')}` }]
      : []),
    ...(source.httpCode
      ? [{ label: t('health.metrics.httpCode'), value: source.httpCode }]
      : []),
    ...(source.lastFetchAgeSec != null
      ? [{ label: t('health.metrics.lastFetch'), value: formatAge(source.lastFetchAgeSec, t) }]
      : []),
    ...(source.linkedUsers != null
      ? [{ label: t('health.metrics.linkedUsers'), value: source.linkedUsers }]
      : []),
    ...metrics,
  ];

  const level = statusToLevel(source.status);
  const accent = LEVEL_COLOR[level];

  return (
    <div className="relative glass p-2.5 pl-3 space-y-1.5 h-full overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: accent, opacity: 0.85 }} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={14} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</div>
            {desc && (
              <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{desc}</div>
            )}
          </div>
        </div>
        <StatusBadge status={source.status} />
      </div>

      {allMetrics.length > 0 && (
        <div className="space-y-0.5 pt-1.5" style={{ borderTop: '1px solid var(--border-glass)' }}>
          {allMetrics.map((m, i) => (
            <MetricRow key={i} label={m.label} value={m.value} color={m.color} />
          ))}
        </div>
      )}

      {source.error && (
        <div className="text-[10px] pt-1.5 truncate font-mono"
          style={{ color: '#ef4444', borderTop: '1px solid var(--border-glass)' }}>
          {source.error}
        </div>
      )}
    </div>
  );
}
