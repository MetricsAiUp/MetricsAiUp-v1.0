import { useState, useEffect, useRef } from 'react';

export default function CameraContextMenu({ x, y, camera, onClose, onWatchStream, onShowZones }) {
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const hasStream = !!camera.rtspCameraId;

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[200px]"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 border-b border-slate-700">
        <div className="text-xs font-semibold text-purple-400">{camera.name}</div>
        {camera.rtspCameraId && (
          <div className="text-xs text-slate-500">{camera.rtspCameraId}</div>
        )}
      </div>

      <button
        onClick={() => { onWatchStream(); onClose(); }}
        disabled={!hasStream}
        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
          hasStream
            ? 'text-slate-200 hover:bg-slate-700'
            : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        Watch stream
        {!hasStream && <span className="text-xs text-slate-600 ml-auto">no RTSP</span>}
      </button>

      <button
        onClick={() => { onShowZones(); onClose(); }}
        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-slate-200 hover:bg-slate-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="4" height="4" />
          <rect x="13" y="13" width="4" height="4" />
        </svg>
        Show zones
      </button>
    </div>
  );
}
