import { useState, useEffect, useRef, useCallback } from 'react';
import { startStream, stopStream, getHlsUrl } from '../../api/streaming';

export default function StreamModal({ camName, rtspCameraId, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | playing | error
  const [error, setError] = useState(null);

  const initStream = useCallback(async () => {
    try {
      setStatus('starting');
      setError(null);
      await startStream(rtspCameraId);

      // Wait for HLS segments to be generated
      const hlsUrl = getHlsUrl(rtspCameraId);
      let attempts = 0;
      const maxAttempts = 15;

      const tryLoad = async () => {
        attempts++;
        try {
          const resp = await fetch(hlsUrl);
          if (resp.ok) {
            loadVideo(hlsUrl);
            return;
          }
        } catch {}
        if (attempts < maxAttempts) {
          setTimeout(tryLoad, 1000);
        } else {
          setStatus('error');
          setError('Timeout waiting for stream');
        }
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

    // Dynamically import hls.js
    try {
      const HlsModule = await import('hls.js');
      const Hls = HlsModule.default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDuration: 3,
          liveMaxLatencyDuration: 6,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          setStatus('playing');
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setStatus('error');
            setError('Stream playback error');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
          setStatus('playing');
        });
      }
    } catch {
      // hls.js not available, try native
      video.src = hlsUrl;
      video.play().catch(() => {});
      setStatus('playing');
    }
  }, []);

  useEffect(() => {
    initStream();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      stopStream(rtspCameraId).catch(() => {});
    };
  }, [initStream, rtspCameraId]);

  const handleClose = async () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    try { await stopStream(rtspCameraId); } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={handleClose}>
      <div
        className="bg-slate-900 rounded-lg border border-slate-600 shadow-2xl w-[800px] max-w-[90vw] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-white">{camName}</h3>
            <span className="text-xs text-slate-400">{rtspCameraId}</span>
          </div>
          <div className="flex items-center gap-3">
            {status === 'playing' && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> LIVE
              </span>
            )}
            <button onClick={handleClose} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
          </div>
        </div>

        {/* Video */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            autoPlay
            muted
            playsInline
          />
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
                <button onClick={initStream} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
