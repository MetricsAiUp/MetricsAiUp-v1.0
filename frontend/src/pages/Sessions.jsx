import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export default function Sessions() {
  const { t } = useTranslation();
  const { api } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('active');

  useEffect(() => {
    api.get(`/api/sessions?status=${status}`)
      .then(res => setSessions(res.data.sessions))
      .catch(console.error);
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('sessions.title')}
        </h2>
        <div className="flex gap-2">
          {['active', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{
                background: status === s ? 'var(--accent)' : 'var(--bg-glass)',
                color: status === s ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${status === s ? 'var(--accent)' : 'var(--border-glass)'}`,
              }}
            >
              {t(`sessions.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-static overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              {['plateNumber', 'entryTime', 'currentZone', 'currentPost', 'status'].map(col => (
                <th key={col} className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t(`sessions.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="hover:opacity-80 transition-opacity" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {s.plateNumber || '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(s.entryTime).toLocaleString()}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {s.zoneStays?.[0]?.zone?.name || '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {s.postStays?.[0]?.post?.name || '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{
                      background: s.status === 'active' ? 'var(--success)' + '22' : 'var(--text-muted)' + '22',
                      color: s.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {t(`sessions.${s.status}`)}
                  </span>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
