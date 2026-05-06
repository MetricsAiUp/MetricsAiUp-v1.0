// Глобальный тоггл «Показать нестыковки» — пишет в User.uiState.showDiscrepancies
// и обновляет contexts/AuthContext.user.uiState. Рендерится на Dashboard,
// DashboardPosts, MapViewer, PostsDetail, MyPost.

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, AlertTriangleIcon } from 'lucide-react';

export default function ShowDiscrepanciesToggle() {
  const { user, api, updateCurrentUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  let uiState = {};
  try { uiState = typeof user.uiState === 'string' ? JSON.parse(user.uiState) : (user.uiState || {}); } catch { uiState = {}; }
  const enabled = uiState.showDiscrepancies === true;

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !enabled;
    try {
      const r = await api.patch('/api/users/me/ui-state', { patch: { showDiscrepancies: next } });
      const nextUiState = r.data?.uiState || { ...uiState, showDiscrepancies: next };
      if (updateCurrentUser) updateCurrentUser({ ...user, uiState: nextUiState });
    } catch (e) {
      // тихо, состояние не двигаем
      console.warn('toggle showDiscrepancies failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={enabled ? 'Скрыть индикаторы нестыковок' : 'Показать индикаторы нестыковок'}
      className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all"
      style={{
        background: enabled ? 'rgba(245,158,11,0.15)' : 'var(--bg-glass)',
        color: enabled ? '#f59e0b' : 'var(--text-secondary)',
        border: `1px solid ${enabled ? 'rgba(245,158,11,0.3)' : 'var(--border-glass)'}`,
      }}
    >
      <AlertTriangle size={13} strokeWidth={2} />
      <span>{enabled ? 'Нестыковки: вкл.' : 'Нестыковки: выкл.'}</span>
    </button>
  );
}
