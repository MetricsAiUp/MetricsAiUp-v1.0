import { useState, useEffect, useRef, useCallback } from 'react';
import { startStream, stopStream, getHlsUrl } from '../../api/streaming';
import useServerMotion from '../../hooks/useServerMotion';

function ZoneOverlay({ zones, showZones }) {
  if (!showZones || !zones || zones.length === 0) return null;
  let maxX = 1920, maxY = 1080;
  zones.forEach(z => {
    if (z.rect.x + z.rect.w > maxX) maxX = z.rect.x + z.rect.w;
    if (z.rect.y + z.rect.h > maxY) maxY = z.rect.y + z.rect.h;
  });
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${maxX} ${maxY}`} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: 'none' }}>
      {zones.map(z => (
        <g key={z.zoneId}>
          <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} fill="none" stroke={z.color || '#22c55e'} strokeWidth={2} opacity={0.8} />
          <text x={z.rect.x + 4} y={z.rect.y + 16} fill={z.color || '#22c55e'} fontSize={14} fontFamily="system-ui" fontWeight="600" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {z.zoneName}
          </text>
        </g>
      ))}
    </svg>
  );
}

function EventLog({ events, clearEvents }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Events</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{events.length}</span>
          {events.length > 0 && (
            <button onClick={clearEvents} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {events.length === 0 && (
          <div className="text-xs text-slate-600 py-4 text-center">No events yet</div>
        )}
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-2 py-1 border-b border-slate-800/50">
            <span className="text-[0.65rem] text-slate-500 font-mono whitespace-nowrap mt-0.5">{ev.time}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full flex-shrink-0 animate-pulse" />
                <span className="text-xs text-yellow-400 font-medium">Движение</span>
              </div>
              <span className="text-[0.7rem] text-slate-400 truncate block">{ev.zoneName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StreamModal({ camName, rtspCameraId, zones2d, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState(null);
  const [showZones, setShowZones] = useState(true);

  const { events, connected, clearEvents } = useServerMotion(rtspCameraId);

  const initStream = useCallback(async () => {
    try {
      setStatus('starting');
      setError(null);
      await startStream(rtspCameraId);
      const hlsUrl = getHlsUrl(rtspCameraId);
      let attempts = 0;
      const tryLoad = async () => {
        attempts++;
        try {
          const resp = await fetch(hlsUrl);
          if (resp.ok) { loadVideo(hlsUrl); return; }
        } catch {}
        if (attempts < 15) setTimeout(tryLoad, 1000);
        else { setStatus('error'); setError('Timeout waiting for stream'); }
      };
      setTimeout(tryLoad, 2000);
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Failed to start stream');
    }
  }, [rtspCameraId]);

  const loadVideo = useCallback(async (hlsUrl) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const HlsModule = await import('hls.js');
      const Hls = HlsModule.default;
      if (Hls.isSupported()) {
        const hls = new Hls({ liveSyncDuration: 3, liveMaxLatencyDuration: 6, enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); setStatus('playing'); });
        hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { setStatus('error'); setError('Stream playback error'); } });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => { video.play().catch(() => {}); setStatus('playing'); });
      }
    } catch {
      video.src = hlsUrl;
      video.play().catch(() => {});
      setStatus('playing');
    }
  }, []);

  useEffect(() => {
    initStream();
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      stopStream(rtspCameraId).catch(() => {});
    };
  }, [initStream, rtspCameraId]);

  const handleClose = async () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    try { await stopStream(rtspCameraId); } catch {}
    onClose();
  };

  const hasZones = zones2d && zones2d.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={handleClose}>
      <div
        className="bg-slate-900 rounded-lg border border-slate-600 shadow-2xl overflow-hidden flex"
        style={{ maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col" style={{ width: 800 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div>
              <h3 className="text-sm font-semibold text-white">{camName}</h3>
              <span className="text-xs text-slate-400">{rtspCameraId}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasZones && (
                <button onClick={() => setShowZones(!showZones)} className={`text-xs px-2 py-1 rounded ${showZones ? 'bg-green-700 text-white' : 'bg-slate-700 text-slate-400'}`}>Zones</button>
              )}
              {status === 'playing' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> LIVE
                </span>
              )}
              <button onClick={handleClose} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
            </div>
          </div>

          <div className="relative bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full" autoPlay muted playsInline />
            <ZoneOverlay zones={zones2d} showZones={showZones} />
            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div className="text-sm text-slate-400">Starting stream...</div>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-red-400 text-sm mb-2">{error}</div>
                  <button onClick={initStream} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">Retry</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {hasZones && (
          <div className="w-64 border-l border-slate-700 bg-slate-900/95 flex flex-col">
            <EventLog events={events} clearEvents={clearEvents} />
          </div>
        )}
      </div>
    </div>
  );
}
