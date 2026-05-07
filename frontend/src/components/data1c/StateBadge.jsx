// Цветной бейдж состояния заказ-наряда из 1С: В работе / Закрыт / Выполнен / прочее.

import { Activity, CheckCircle2, Circle, Clock } from 'lucide-react';

const RULES = [
  { test: (s) => /закры/i.test(s), color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 },
  { test: (s) => /выполн/i.test(s), color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: CheckCircle2 },
  { test: (s) => /работ/i.test(s), color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Activity },
  { test: (s) => /оформ|прин|открыт|нов/i.test(s), color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock },
];

export default function StateBadge({ state, size = 'md' }) {
  if (!state) return <span style={{ color: 'var(--text-muted)' }}>·</span>;
  const rule = RULES.find((r) => r.test(state)) || { color: 'var(--text-muted)', bg: 'var(--bg-glass)', icon: Circle };
  const Icon = rule.icon;
  const padX = size === 'sm' ? '0.4rem' : '0.55rem';
  const padY = size === 'sm' ? '0.1rem' : '0.18rem';
  const fontSize = size === 'sm' ? '11px' : '12px';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap"
      style={{
        color: rule.color,
        background: rule.bg,
        padding: `${padY} ${padX}`,
        fontSize,
        border: `1px solid ${rule.color}33`,
      }}
    >
      <Icon size={11} />
      {state}
    </span>
  );
}
