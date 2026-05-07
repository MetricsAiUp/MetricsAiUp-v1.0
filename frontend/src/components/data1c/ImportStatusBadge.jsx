// Бейдж статуса импорта: success / partial / pending / error_*.

import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function classify(status) {
  if (!status) return 'unknown';
  if (status === 'success') return 'success';
  if (status === 'partial') return 'partial';
  if (status === 'pending') return 'pending';
  if (status.startsWith('error')) return 'error';
  return 'unknown';
}

const VARIANTS = {
  success: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 },
  partial: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: AlertTriangle },
  pending: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Clock },
  error:   { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle },
  unknown: { color: 'var(--text-muted)', bg: 'var(--bg-glass)', icon: Clock },
};

export default function ImportStatusBadge({ status, error }) {
  const { t } = useTranslation();
  const cls = classify(status);
  const cfg = VARIANTS[cls];
  const Icon = cfg.icon;
  const label = t(`data1c.imports.statusName.${cls}`, cls);
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
      title={error ? `${status}: ${error}` : status}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}
