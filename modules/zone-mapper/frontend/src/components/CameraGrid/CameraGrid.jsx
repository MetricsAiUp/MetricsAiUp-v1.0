import { useState, useEffect, useRef, useCallback } from 'react';
import { RTSP_CAMERAS, startStream, stopStream, getHlsUrl, startMotion, stopMotion } from '../../api/streaming';
import { useStore } from '../../store/useStore';
import { getZones2d } from '../../api/client';
import useServerMotion from '../../hooks/useServerMotion';

function ZoneOverlaySvg({ zones }) {
  if (!zones || zones.length === 0) return null;
  let maxX = 1920, maxY = 1080;
  zones.forEach(z => {
    if (z.rect.x + z.rect.w > maxX) maxX = z.rect.x + z.rect.w;
    if (z.rect.y + z.rect.h > maxY) maxY = z.rect.y + z.rect.h;
  });
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${maxX} ${maxY}`} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: 'none' }}>
      {zones.map(z => (
        <g key={z.zoneId}>
          <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} fill="none" stroke={z.color || '#22c55e'} strokeWidth={2.5} opacity={0.8} />
          <text x={z.rect.x + 4} y={z.rect.y + 16} fill={z.color || '#22c55e'} fontSize={13} fontFamily="system-ui" fontWeight="600" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {z.zoneName}
          </text>
        </g>
      ))}
    </svg>
  );
}

function EventLog({ events, clearEvents, connected }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#333]">
        <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          Events
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] text-slate-500">{events.length}</span>
          {events.length > 0 && (
            <button onClick={clearEvents} className="text-[0.6rem] text-slate-500 hover:text-slate-300">x</button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1">
        {events.length === 0 && (
          <div className="text-[0.65rem] text-[#444] py-3 text-center">Нет событий</div>
        )}
        {events.map(ev => (
          <div key={ev.id} className="flex items-center gap-1.5 py-0.5 border-b border-[#2a2a2a]">
            <span className="text-[0.6rem] text-slate-500 font-mono">{ev.timeLocal || ev.time}</span>
            <span className="w-1 h-1 bg-yellow-500 rounded-full flex-shrink-0" />
            <span className="text-[0.6rem] text-yellow-400 truncate flex-1">{ev.zoneName}</span>
            {ev.intensity && <span className="text-[0.55rem] text-slate-600">{ev.intensity}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraCard({ cam, roomCameras, linkedCamera }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('offline');
  const [zones2d, setZones2d] = useState(null);
  const [showZones, setShowZones] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [frameInterval, setFrameInterval] = useState(5);
  const { currentRoom } = useStore();

  const { events, connected, clearEvents } = useServerMotion(cam.id);

  // Load zones
  useEffect(() => {
    if (!currentRoom || !linkedCamera) return;
    getZones2d(currentRoom.id, linkedCamera.id).then(z => setZones2d(z)).catch(() => {});
  }, [currentRoom, linkedCamera]);

  // Start/stop server-side motion detection
  const toggleDetection = async () => {
    if (detecting) {
      await stopMotion(cam.id).catch(() => {});
      setDetecting(false);
    } else if (zones2d && zones2d.length > 0 && linkedCamera) {
      await startMotion(cam.id, {
        frameInterval,
        zones: zones2d,
        resolution: linkedCamera.resolution || { width: 1920, height: 1080 },
      }).catch(() => {});
      setDetecting(true);
    }
  };

  const handleStart = async () => {
    setStatus('connecting');
    try {
      await startStream(cam.id);
      const hlsUrl = getHlsUrl(cam.id);
      let attempts = 0;
      const tryLoad = () => {
        attempts++;
        fetch(hlsUrl).then(r => {
          if (r.ok) loadVideo(hlsUrl);
          else if (attempts < 15) setTimeout(tryLoad, 1000);
          else setStatus('error');
        }).catch(() => {
          if (attempts < 15) setTimeout(tryLoad, 1000);
          else setStatus('error');
        });
      };
      setTimeout(tryLoad, 2000);
    } catch { setStatus('error'); }
  };

  const loadVideo = async (hlsUrl) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const HlsModule = await import('hls.js');
      const Hls = HlsModule.default;
      if (Hls.isSupported()) {
        const hls = new Hls({ liveSyncDuration: 3, liveMaxLatencyDuration: 6 });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); setStreaming(true); setStatus('online'); });
        hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setStatus('error'); });
      }
    } catch { setStatus('error'); }
  };

  const handleStop = async () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    try { await stopStream(cam.id); } catch {}
    setStreaming(false);
    setStatus('offline');
    if (videoRef.current) videoRef.current.src = '';
  };

  useEffect(() => () => { if (hlsRef.current) { hlsRef.current.destroy(); } }, []);

  const statusColors = {
    offline: 'bg-red-500/15 text-red-500', connecting: 'bg-yellow-500/15 text-yellow-500',
    online: 'bg-green-500/15 text-green-500', error: 'bg-red-500/15 text-red-500',
  };
  const statusLabels = { offline: 'Офлайн', connecting: 'Подключение...', online: 'Онлайн', error: 'Ошибка' };
  const hasZones = zones2d && zones2d.length > 0;
  const showEvents = hasZones && (detecting || events.length > 0);

  return (
    <div className={`bg-[#252525] border border-[#333] rounded-lg overflow-hidden ${streaming ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Video + Events */}
      <div className="flex">
        <div className={`relative bg-[#111] ${showEvents ? 'flex-1 min-w-0' : 'w-full'}`}>
          <div style={{ aspectRatio: '16/9' }} className="relative">
            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center text-[#444] text-sm">Стрим остановлен</div>
            )}
            {streaming && (
              <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-red-500 text-[0.7rem] font-semibold tracking-wider z-10">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> REC
              </div>
            )}
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            {streaming && showZones && hasZones && <ZoneOverlaySvg zones={zones2d} />}
            {streaming && hasZones && (
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                <button onClick={() => setShowZones(!showZones)} className={`text-[0.6rem] px-1.5 py-0.5 rounded ${showZones ? 'bg-green-700/80 text-white' : 'bg-black/50 text-slate-400'}`}>
                  Zones
                </button>
              </div>
            )}
          </div>
        </div>
        {showEvents && (
          <div className="w-36 border-l border-[#333] bg-[#1e1e1e]" style={{ minHeight: 0 }}>
            <EventLog events={events} clearEvents={clearEvents} connected={connected} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div>
          <div className="text-[0.85rem] font-medium text-[#ddd]">{cam.name}</div>
          <div className="text-[0.75rem] text-[#666]">Зона: СТО</div>
        </div>
        <span className={`text-[0.7rem] px-2.5 py-0.5 rounded-xl font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>

      {/* Controls */}
      <div className="px-4 pb-2 flex gap-2">
        <button onClick={handleStart} disabled={streaming || status === 'connecting'}
          className="flex-1 py-1.5 rounded-md text-[0.78rem] font-medium bg-green-500/20 text-green-500 hover:bg-green-500/35 disabled:opacity-40 disabled:cursor-not-allowed">
          Старт
        </button>
        <button onClick={handleStop} disabled={!streaming && status !== 'connecting'}
          className="flex-1 py-1.5 rounded-md text-[0.78rem] font-medium bg-red-500/20 text-red-500 hover:bg-red-500/35 disabled:opacity-40 disabled:cursor-not-allowed">
          Стоп
        </button>
      </div>

      {/* Motion detection controls */}
      {hasZones && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <button onClick={toggleDetection}
            className={`flex-1 py-1 rounded-md text-[0.72rem] font-medium ${detecting ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
            {detecting ? '⏹ Stop detection' : '▶ Start detection'}
          </button>
          <select
            value={frameInterval}
            onChange={e => setFrameInterval(+e.target.value)}
            className="bg-[#333] text-[0.7rem] text-slate-300 border border-[#444] rounded px-1.5 py-1"
          >
            <option value={1}>1s</option>
            <option value={2}>2s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default function CameraGrid() {
  const { currentRoom } = useStore();
  const roomCameras = currentRoom?.cameras || [];

  return (
    <div className="h-full overflow-y-auto bg-[#1a1a1a] p-6">
      <h2 className="text-lg font-semibold text-white mb-5">Камеры наблюдения</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {RTSP_CAMERAS.map(cam => {
          const linked = roomCameras.find(c => c.rtspCameraId === cam.id);
          return <CameraCard key={cam.id} cam={cam} roomCameras={roomCameras} linkedCamera={linked} />;
        })}
      </div>
    </div>
  );
}
