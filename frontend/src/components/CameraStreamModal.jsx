import { useEffect, useRef, useState } from 'react';
import { Camera, X, Maximize2, Play, Square, RefreshCw } from 'lucide-react';
import Hls from 'hls.js';

const STREAM_PORT = 8181;

function getStreamUrl(camId) {
  return `https://artisom.dev.metricsavto.com:${STREAM_PORT}/hls/${camId}/stream.m3u8`;
}

function getApiUrl(path) {
  return `https://artisom.dev.metricsavto.com:${STREAM_PORT}${path}`;
}

export default function CameraStreamModal({ camId, camName, camLocation, camCovers, isRu, isDark, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, playing, error, offline
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Update clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // Start stream and connect HLS
  useEffect(() => {
    if (!camId) return;
    let cancelled = false;

    const connect = async () => {
      setStatus('connecting');

      // Try to start stream on server
      try {
        await fetch(getApiUrl(`/api/stream/start/${camId}`), { method: 'POST' });
      } catch {
        // Stream server might be down
        setStatus('offline');
        return;
      }

      // Wait for m3u8 to appear (FFmpeg needs a few seconds)
      await new Promise(r => setTimeout(r, 3000));
      if (cancelled) return;

      const url = getStreamUrl(camId);
      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) {
            video.play().catch(() => {});
            setStatus('playing');
          }
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setStatus('offline');
            } else {
              setStatus('error');
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
          setStatus('playing');
        });
      } else {
        setStatus('error');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [camId]);

  const handleStop = async () => {
    if (hlsRef.current) hlsRef.current.destroy();
    try { await fetch(getApiUrl(`/api/stream/stop/${camId}`), { method: 'POST' }); } catch {}
    setStatus('offline');
  };

  const handleRestart = () => {
    if (hlsRef.current) hlsRef.current.destroy();
    setStatus('connecting');
    // Re-trigger effect
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      fetch(getApiUrl(`/api/stream/start/${camId}`), { method: 'POST' })
        .then(() => new Promise(r => setTimeout(r, 3000)))
        .then(() => {
          const hls = new Hls({ liveSyncDurationCount: 2, enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(getStreamUrl(camId));
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            setStatus('playing');
          });
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setStatus('error'); });
        })
        .catch(() => setStatus('offline'));
    }, 100);
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        {/* Video area */}
        <div className="relative rounded-t-xl overflow-hidden"
          style={{ aspectRatio: '16/9', background: '#000' }}>

          {/* Actual video element */}
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain"
            muted autoPlay playsInline
            style={{ display: status === 'playing' ? 'block' : 'none' }} />

          {/* Placeholder when not playing */}
          {status !== 'playing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {status === 'connecting' && (
                <>
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <span className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {isRu ? 'Подключение к камере...' : 'Connecting to camera...'}
                  </span>
                </>
              )}
              {status === 'offline' && (
                <>
                  <Camera size={48} style={{ color: 'rgba(148,163,184,0.25)' }} />
                  <span className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {isRu ? 'Камера недоступна' : 'Camera offline'}
                  </span>
                  <button onClick={handleRestart}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white hover:opacity-80"
                    style={{ background: 'var(--accent)' }}>
                    <RefreshCw size={12} />
                    {isRu ? 'Переподключить' : 'Reconnect'}
                  </button>
                </>
              )}
              {status === 'error' && (
                <>
                  <Camera size={48} style={{ color: 'rgba(239,68,68,0.4)' }} />
                  <span className="text-sm" style={{ color: 'rgba(239,68,68,0.6)' }}>
                    {isRu ? 'Ошибка стрима' : 'Stream error'}
                  </span>
                  <button onClick={handleRestart}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white hover:opacity-80"
                    style={{ background: 'var(--accent)' }}>
                    <RefreshCw size={12} />
                    {isRu ? 'Перезапустить' : 'Restart'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status === 'playing' ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white font-bold text-sm">{camName}</span>
              {status === 'playing' && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.3)', color: '#fff' }}>
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === 'playing' && (
                <>
                  <button onClick={handleStop} className="p-1.5 rounded hover:bg-white/10" title="Stop">
                    <Square size={14} color="white" />
                  </button>
                  <button onClick={handleFullscreen} className="p-1.5 rounded hover:bg-white/10" title="Fullscreen">
                    <Maximize2 size={14} color="white" />
                  </button>
                </>
              )}
              {status !== 'playing' && status !== 'connecting' && (
                <button onClick={handleRestart} className="p-1.5 rounded hover:bg-white/10" title="Start">
                  <Play size={14} color="white" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10"><X size={14} color="white" /></button>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2"
            style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
            <span className="text-xs text-white/60 font-mono">{time}</span>
            <span className="text-xs text-white/40">{camLocation}</span>
          </div>
        </div>

        {/* Info bar */}
        <div className="rounded-b-xl p-4 flex items-center justify-between"
          style={{ background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', border: '1px solid var(--border-glass)', borderTop: 'none' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{camName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{camLocation}</p>
          </div>
          {camCovers && (
            <div className="flex flex-wrap gap-1">
              {camCovers.split(', ').map(z => (
                <span key={z} className="px-2 py-0.5 rounded text-xs"
                  style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', color: 'var(--accent)' }}>
                  {z}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
