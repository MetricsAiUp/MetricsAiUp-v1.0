// Утилиты форматирования для Health-страницы.

export const LEVEL_COLOR = {
  ok: '#10b981',
  warn: '#f59e0b',
  critical: '#ef4444',
};

export const LEVEL_BG = {
  ok: 'rgba(16,185,129,0.12)',
  warn: 'rgba(245,158,11,0.12)',
  critical: 'rgba(239,68,68,0.12)',
};

export function statusToLevel(status) {
  if (status === 'ok' || status === 'success' || status === 'running') return 'ok';
  if (status === 'degraded' || status === 'warn') return 'warn';
  if (status === 'down' || status === 'error' || status === 'critical') return 'critical';
  return 'warn';
}

export function pctToLevel(pct, warnAt = 85, critAt = 95) {
  if (pct == null) return 'ok';
  if (pct >= critAt) return 'critical';
  if (pct >= warnAt) return 'warn';
  return 'ok';
}

export function scoreLevel(score) {
  if (score == null) return 'warn';
  if (score >= 90) return 'ok';
  if (score >= 70) return 'warn';
  return 'critical';
}

export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  const gb = bytes / 1073741824;
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`;
  const mb = bytes / 1048576;
  if (mb >= 1) return `${mb.toFixed(0)} МБ`;
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

export function formatUptime(sec, isRu = true) {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (d > 0) return isRu ? `${d}д ${h}ч ${m}м` : `${d}d ${h}h ${m}m`;
  if (h > 0) return isRu ? `${h}ч ${m}м` : `${h}h ${m}m`;
  if (m > 0) return isRu ? `${m}м ${s}с` : `${m}m ${s}s`;
  return isRu ? `${s}с` : `${s}s`;
}

export function formatAge(sec, t) {
  if (sec == null) return t('health.never');
  if (sec < 5) return t('health.ago.now');
  if (sec < 60) return t('health.ago.secondsAgo', { n: sec });
  if (sec < 3600) return t('health.ago.minutesAgo', { n: Math.floor(sec / 60) });
  if (sec < 86400) return t('health.ago.hoursAgo', { n: Math.floor(sec / 3600) });
  return t('health.ago.daysAgo', { n: Math.floor(sec / 86400) });
}

export function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toFixed(2)} с`;
}
