import { LEVEL_COLOR, pctToLevel } from './healthUtils';

// Прогресс-бар с маркерами 85%/95% и цветной индикацией текущего значения.
export default function ResourceBar({ label, percent, hint, height = 8 }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const level = pctToLevel(pct);
  const color = LEVEL_COLOR[level];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="relative w-full rounded-full overflow-hidden"
        style={{ height, background: 'var(--bg-glass)' }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }} />
        {/* Маркеры 85% и 95% */}
        <div className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: '85%', width: 1, background: 'rgba(245,158,11,0.5)' }} />
        <div className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: '95%', width: 1, background: 'rgba(239,68,68,0.5)' }} />
      </div>
      {hint && (
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{hint}</div>
      )}
    </div>
  );
}
