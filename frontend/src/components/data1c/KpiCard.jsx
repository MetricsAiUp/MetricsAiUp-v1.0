// Компактная KPI-карточка с цифрой и подписью.
// props: { label, value, icon: LucideIcon, tone, onClick, active }
// tone: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const TONES = {
  default: { color: 'var(--text-primary)',  border: 'var(--border-glass)' },
  success: { color: '#10b981',              border: 'rgba(16, 185, 129, 0.4)' },
  warning: { color: '#f59e0b',              border: 'rgba(245, 158, 11, 0.4)' },
  danger:  { color: '#ef4444',              border: 'rgba(239, 68, 68, 0.4)' },
  info:    { color: '#3b82f6',              border: 'rgba(59, 130, 246, 0.4)' },
  accent:  { color: 'var(--accent)',        border: 'rgba(99, 102, 241, 0.4)' },
};

export default function KpiCard({ label, value, icon: Icon, tone = 'default', onClick, active = false, hint }) {
  const t = TONES[tone] || TONES.default;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all text-left min-w-[130px]"
      style={{
        background: active ? `${t.color}1A` : 'var(--bg-glass)',
        border: `1px solid ${active ? t.color : t.border}`,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: active ? `0 0 0 1px ${t.color}30` : 'var(--shadow-glass)',
      }}
    >
      {Icon && (
        <div
          className="rounded-md p-1.5 flex items-center justify-center"
          style={{ background: `${t.color}1F`, color: t.color }}
        >
          <Icon size={14} />
        </div>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <span className="text-base font-bold" style={{ color: t.color }}>{value}</span>
        {hint && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
    </button>
  );
}
