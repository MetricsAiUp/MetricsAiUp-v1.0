// Унифицированная строка label/value в карточке Health.
export default function MetricRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[11px] font-mono tabular-nums truncate" style={{ color: color || 'var(--text-secondary)' }}>
        {value}
      </span>
    </div>
  );
}
