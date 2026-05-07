// Бейдж типа импорта 1С: plan / repair / performed.

import { CalendarRange, Wrench, Activity, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TYPES = {
  plan:      { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: CalendarRange },
  repair:    { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Wrench },
  performed: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Activity },
};

export default function ImportTypeBadge({ type }) {
  const { t } = useTranslation();
  if (!type) return <span style={{ color: 'var(--text-muted)' }}>·</span>;
  const cfg = TYPES[type] || { color: 'var(--text-muted)', bg: 'var(--bg-glass)', icon: HelpCircle };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium"
      style={{
        color: cfg.color,
        background: cfg.bg,
        padding: '0.18rem 0.55rem',
        fontSize: '12px',
        border: `1px solid ${cfg.color}33`,
      }}
    >
      <Icon size={11} />
      {t(`data1c.imports.typeName.${type}`, type)}
    </span>
  );
}
