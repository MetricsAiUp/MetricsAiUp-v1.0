import { useEffect, useRef, useState } from 'react';
import { Camera, X, Maximize2, Play, Square, RefreshCw } from 'lucide-react';
import Hls from 'hls.js';

const STREAM_BASE = 'https://dev.metricsavto.com/p/test1/8181';

function getStreamUrl(camId) {
  return `${STREAM_BASE}/hls/${camId}/stream.m3u8`;
}

function getApiUrl(path) {
  return `${STREAM_BASE}${path}`;
}

function attachHls(videoEl, url, onPlaying, onError) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      enableWorker: true,
      lowLatencyMode: true,
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 2000,
      levelLoadingTimeOut: 15000,
      levelLoadingMaxRetry: 6,
      fragLoadingTimeOut: 15000,
      fragLoadingMaxRetry: 6,
    });
    hls.loadSource(url);
    hls.attachMedia(videoEl);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(() => {});
      onPlaying();
    });
    let retries = 0;
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      if (retries < 3 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        retries++;
        setTimeout(() => hls.startLoad(), 2000);
      } else if (retries < 3 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        retries++;
        hls.recoverMediaError();
      } else {
        onError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'offline' : 'error');
      }
    });
    hls.on(Hls.Events.FRAG_LOADED, () => { retries = 0; });
    return hls;
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = url;
    videoEl.addEventListener('loadedmetadata', () => { videoEl.play().catch(() => {}); onPlaying(); });
    videoEl.addEventListener('error', () => onError('error'));
    return null;
  }
  onError('error');
  return null;
}

export default function CameraStreamModal({ camId, camName, camLocation, camCovers, isRu, isDark, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, playing, error, offline
  const fmt = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' });
  const [time, setTime] = useState(fmt);

  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  // Connect to stream
  useEffect(() => {
    if (!camId) return;
    let cancelled = false;

    const connect = async () => {
      setStatus('connecting');

      // 1. Check if already streaming
      let alreadyStreaming = false;
      try {
        const statusRes = await fetch(getApiUrl('/api/stream/status'));
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          alreadyStreaming = statusData[camId]?.streaming === true;
        }
      } catch {}

      // 2. If not streaming, start it
      if (!alreadyStreaming) {
        try {
          const startRes = await fetch(getApiUrl(`/api/stream/start/${camId}`), { method: 'POST' });
          if (!startRes.ok) { setStatus('offline'); return; }
        } catch {
          setStatus('offline');
          return;
        }
        // Wait for FFmpeg to generate segments
        await new Promise(r => setTimeout(r, 4000));
        if (cancelled) return;
      }

      // 3. Attach HLS player
      const video = videoRef.current;
      if (!video || cancelled) return;

      const hls = attachHls(
        video,
        getStreamUrl(camId),
        () => { if (!cancelled) setStatus('playing'); },
        (err) => { if (!cancelled) setStatus(err); },
      );
      hlsRef.current = hls;
    };

    connect();

    return () => {
      cancelled = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [camId]);

  const handleStop = async () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    try { await fetch(getApiUrl(`/api/stream/stop/${camId}`), { method: 'POST' }); } catch {}
    setStatus('offline');
  };

  const handleRestart = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setStatus('connecting');
    setTimeout(async () => {
      try {
        await fetch(getApiUrl(`/api/stream/start/${camId}`), { method: 'POST' });
      } catch { setStatus('offline'); return; }
      await new Promise(r => setTimeout(r, 4000));
      const video = videoRef.current;
      if (!video) return;
      const hls = attachHls(
        video, getStreamUrl(camId),
        () => setStatus('playing'),
        (err) => setStatus(err),
      );
      hlsRef.current = hls;
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

          <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain"
            muted autoPlay playsInline
            style={{ display: status === 'playing' ? 'block' : 'none' }} />

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
