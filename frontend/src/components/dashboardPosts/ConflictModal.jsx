import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export default function ConflictModal({ conflicts, onReload, onForce, onClose }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === 'ru';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-static p-6 rounded-2xl max-w-md w-full mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Конфликт данных' : 'Data Conflict'}
          </h3>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isRu ? 'Некоторые заказ-наряды были изменены другим пользователем.' : 'Some work orders were modified by another user.'}
        </p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {conflicts.map((c, i) => (
            <div key={i} className="text-xs p-2 rounded-lg" style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)' }}>
              {c.reason === 'version_mismatch' ? `WO: v${c.clientVersion} → v${c.serverVersion}` : c.reason}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onReload} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
            {isRu ? 'Обновить данные' : 'Reload data'}
          </button>
          <button onClick={onForce} className="flex-1 px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}>
            {isRu ? 'Перезаписать' : 'Overwrite'}
          </button>
        </div>
      </div>
    </div>
  );
}
