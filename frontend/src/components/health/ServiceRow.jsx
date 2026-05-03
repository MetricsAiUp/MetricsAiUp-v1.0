import { useTranslation } from 'react-i18next';
import { Activity, Clock, AlertTriangle } from 'lucide-react';
import { LEVEL_COLOR, formatAge } from './healthUtils';

// Компактная плитка одного фонового сервиса.
// Layout: [● name] [meta] / [ticks · errors · last]
export default function ServiceRow({ service }) {
  const { t } = useTranslation();
  const running = !!service.running;
  const hasError = !!service.lastError;
  const level = !running ? 'critical' : hasError ? 'warn' : 'ok';
  const color = LEVEL_COLOR[level];

  const lastTickAge = service.lastTickAt
    ? Math.floor((Date.now() - new Date(service.lastTickAt).getTime()) / 1000)
    : null;

  const metaInline = [
    service.meta?.type,
    service.meta?.interval != null
      ? (service.meta.interval >= 1000
          ? `${Math.round(service.meta.interval / 1000)}s`
          : `${service.meta.interval}ms`)
      : null,
  ].filter(Boolean).join(' • ');

  return (
    <div className="glass p-2.5 space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block rounded-full flex-shrink-0"
          style={{ width: 7, height: 7, background: color, boxShadow: `0 0 5px ${color}` }} />
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
          {service.name}
        </span>
        {metaInline && (
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {metaInline}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums"
        style={{ color: 'var(--text-muted)' }}>
        <div className="flex items-center gap-1">
          <Activity size={10} />
          <span className="font-mono">{service.ticks ?? 0}</span>
          {service.errors > 0 && (
            <>
              <AlertTriangle size={10} style={{ color: '#ef4444' }} className="ml-1.5" />
              <span className="font-mono" style={{ color: '#ef4444' }}>{service.errors}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 truncate">
          <Clock size={10} />
          <span className="truncate">
            {lastTickAge != null ? formatAge(lastTickAge, t) : t('health.never')}
          </span>
        </div>
      </div>
    </div>
  );
}
