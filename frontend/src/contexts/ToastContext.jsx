import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10b981' },
  error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  info: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: '#6366f1' },
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 5000) => {
    const id = ++nextId;
    setToasts(prev => {
      const next = [...prev, { id, type, message }];
      return next.slice(-3); // max 3 toasts
    });
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur ?? 8000),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2" style={{ maxWidth: 380 }}>
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          const color = COLORS[t.type] || COLORS.info;
          return (
            <div key={t.id}
              className="flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg animate-slide-in"
              style={{
                background: color.bg,
                border: `1px solid ${color.border}`,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}>
              <Icon size={16} style={{ color: color.text, flexShrink: 0, marginTop: 1 }} />
              <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{t.message}</span>
              <button onClick={() => removeToast(t.id)} className="hover:opacity-60 flex-shrink-0">
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
