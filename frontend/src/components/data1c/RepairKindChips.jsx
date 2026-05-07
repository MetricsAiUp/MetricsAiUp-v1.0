// Chips для отображения видов работ исполнителя (компактно вместо длинной строки).
// kinds: [{ kind, count }]

const PALETTE = [
  { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)' },
];

function hashColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function RepairKindChips({ kinds, max = 8 }) {
  if (!kinds || !kinds.length) return <span style={{ color: 'var(--text-muted)' }}>·</span>;
  const sorted = [...kinds].sort((a, b) => b.count - a.count);
  const visible = sorted.slice(0, max);
  const hidden = sorted.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((rk) => {
        const c = hashColor(rk.kind);
        return (
          <span
            key={rk.kind}
            className="inline-flex items-center gap-1 rounded-full whitespace-nowrap"
            style={{
              color: c.color,
              background: c.bg,
              padding: '0.12rem 0.5rem',
              fontSize: '11px',
              fontWeight: 500,
              border: `1px solid ${c.color}33`,
            }}
          >
            {rk.kind}
            <span style={{ opacity: 0.7, fontWeight: 700 }}>×{rk.count}</span>
          </span>
        );
      })}
      {hidden > 0 && (
        <span
          className="inline-flex items-center rounded-full"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-glass)',
            padding: '0.12rem 0.5rem',
            fontSize: '11px',
            border: '1px solid var(--border-glass)',
          }}
          title={sorted.slice(max).map((r) => `${r.kind} ×${r.count}`).join(', ')}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
