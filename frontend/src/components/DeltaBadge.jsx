export default function DeltaBadge({ value, suffix = '%', inverse = false }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const positive = inverse ? value < 0 : value > 0;
  const color = positive ? '#10b981' : value === 0 ? '#94a3b8' : '#ef4444';
  const arrow = value > 0 ? '\u2191' : value < 0 ? '\u2193' : '';
  return <span style={{ color, fontSize: 10, fontWeight: 600 }}>{arrow}{Math.abs(value).toFixed(1)}{suffix}</span>;
}
