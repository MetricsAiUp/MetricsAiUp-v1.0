import { useState } from 'react';
import { Settings, X } from 'lucide-react';

// Settings panel for shift times, post count, and mode
export default function ShiftSettings({ settings, onSettingsChange, onClose, t }) {
  const [local, setLocal] = useState({ ...settings });

  const handleSave = () => {
    onSettingsChange(local);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        style={{ border: '1px solid var(--border-glass)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('dashboardPosts.settings')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Shift start */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.shiftStart')}
            </label>
            <input
              type="time"
              value={local.shiftStart}
              onChange={(e) => setLocal({ ...local, shiftStart: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Shift end */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.shiftEnd')}
            </label>
            <input
              type="time"
              value={local.shiftEnd}
              onChange={(e) => setLocal({ ...local, shiftEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Posts count */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.postsCount')}
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={local.postsCount}
              onChange={(e) => setLocal({ ...local, postsCount: parseInt(e.target.value, 10) || 10 })}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              {t('dashboardPosts.mode')}
            </label>
            <div className="flex gap-2">
              {['demo', 'live'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLocal({ ...local, mode })}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: local.mode === mode ? 'var(--accent)' : 'var(--bg-glass)',
                    color: local.mode === mode ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${local.mode === mode ? 'var(--accent)' : 'var(--border-glass)'}`,
                  }}
                >
                  {mode === 'demo' ? 'Demo' : 'Live'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm"
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
