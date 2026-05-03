import { useTranslation } from 'react-i18next';
import { LEVEL_BG, LEVEL_COLOR, statusToLevel } from './healthUtils';

// Маленький бейдж со статусом сервиса. Использует translate-ключи health.status.*.
export default function StatusBadge({ status, level: levelOverride, label }) {
  const { t } = useTranslation();
  const level = levelOverride || statusToLevel(status);
  const color = LEVEL_COLOR[level];
  const bg = LEVEL_BG[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
      style={{ background: bg, color }}
    >
      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: color }} />
      {label || t(`health.status.${status}`, status)}
    </span>
  );
}
