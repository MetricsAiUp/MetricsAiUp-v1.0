import { useState, useEffect, useRef, useCallback } from 'react';
import { RTSP_CAMERAS, startStream, stopStream, getHlsUrl, getStreamStatus } from '../../api/streaming';
import { useStore } from '../../store/useStore';
import { getZones2d } from '../../api/client';

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

function CameraCard({ cam, roomCameras }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState('offline'); // offline | connecting | online | error
  const [zones2d, setZones2d] = useState(null);
  const [showZones, setShowZones] = useState(true);
  const { currentRoom } = useStore();

  // Find linked 3D camera to load zones
  useEffect(() => {
    if (!currentRoom || !roomCameras) return;
    const linked = roomCameras.find(c => c.rtspCameraId === cam.id);
    if (linked) {
      getZones2d(currentRoom.id, linked.id).then(z => setZones2d(z)).catch(() => {});
    }
  }, [currentRoom, roomCameras, cam.id]);

  const handleStart = async () => {
    setStatus('connecting');
    try {
      await startStream(cam.id);
      const hlsUrl = getHlsUrl(cam.id);

      // Poll for HLS
      let attempts = 0;
      const tryLoad = () => {
        attempts++;
        fetch(hlsUrl).then(r => {
          if (r.ok) {
            loadVideo(hlsUrl);
          } else if (attempts < 15) {
            setTimeout(tryLoad, 1000);
          } else {
            setStatus('error');
          }
        }).catch(() => {
          if (attempts < 15) setTimeout(tryLoad, 1000);
          else setStatus('error');
        });
      };
      setTimeout(tryLoad, 2000);
    } catch {
      setStatus('error');
    }
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setStreaming(true);
          setStatus('online');
        });
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (d.fatal) setStatus('error');
        });
      }
    } catch {
      setStatus('error');
    }
  };

  const handleStop = async () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    try { await stopStream(cam.id); } catch {}
    setStreaming(false);
    setStatus('offline');
    if (videoRef.current) videoRef.current.src = '';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, []);

  const statusColors = {
    offline: 'bg-red-500/15 text-red-500',
    connecting: 'bg-yellow-500/15 text-yellow-500',
    online: 'bg-green-500/15 text-green-500',
    error: 'bg-red-500/15 text-red-500',
  };
  const statusLabels = { offline: 'Офлайн', connecting: 'Подключение...', online: 'Онлайн', error: 'Ошибка' };

  const hasZones = zones2d && zones2d.length > 0;

  return (
    <div className={`bg-[#252525] border border-[#333] rounded-lg overflow-hidden ${streaming ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Video area */}
      <div className="relative aspect-video bg-[#111]">
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center text-[#444] text-sm">
            Стрим остановлен
          </div>
        )}
        {streaming && (
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-red-500 text-[0.7rem] font-semibold tracking-wider z-10">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            REC
          </div>
        )}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        {/* Zone overlay */}
        {streaming && showZones && hasZones && <ZoneOverlaySvg zones={zones2d} />}
        {/* Zone toggle */}
        {streaming && hasZones && (
          <button
            onClick={() => setShowZones(!showZones)}
            className={`absolute top-2 right-2 z-10 text-[0.65rem] px-1.5 py-0.5 rounded ${showZones ? 'bg-green-700/80 text-white' : 'bg-black/50 text-slate-400'}`}
          >
            Zones
          </button>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[0.85rem] font-medium text-[#ddd]">{cam.name}</div>
          <div className="text-[0.75rem] text-[#666]">Зона: СТО</div>
        </div>
        <span className={`text-[0.7rem] px-2.5 py-0.5 rounded-xl font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>

      {/* Controls */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={handleStart}
          disabled={streaming || status === 'connecting'}
          className="flex-1 py-1.5 rounded-md text-[0.78rem] font-medium bg-green-500/20 text-green-500 hover:bg-green-500/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Старт
        </button>
        <button
          onClick={handleStop}
          disabled={!streaming && status !== 'connecting'}
          className="flex-1 py-1.5 rounded-md text-[0.78rem] font-medium bg-red-500/20 text-red-500 hover:bg-red-500/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Стоп
        </button>
      </div>
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
        {RTSP_CAMERAS.map(cam => (
          <CameraCard key={cam.id} cam={cam} roomCameras={roomCameras} />
        ))}
      </div>
    </div>
  );
}
