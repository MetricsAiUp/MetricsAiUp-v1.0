import { useRef, useEffect, useCallback, useState } from 'react';

const DETECTION_INTERVAL = 400; // ms between checks
const MOTION_THRESHOLD = 25;    // per-pixel diff threshold
const ZONE_MOTION_PCT = 0.8;    // % of changed pixels to trigger motion
const COOLDOWN_MS = 2000;        // cooldown per zone before re-triggering

export default function useMotionDetection(videoRef, zones, enabled = true) {
  const [events, setEvents] = useState([]);
  const prevFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastTriggerRef = useRef({});  // zoneId -> timestamp
  const intervalRef = useRef(null);

  const addEvent = useCallback((zoneId, zoneName, type = 'motion') => {
    const now = Date.now();
    const last = lastTriggerRef.current[zoneId] || 0;
    if (now - last < COOLDOWN_MS) return;
    lastTriggerRef.current[zoneId] = now;

    const event = {
      id: now + '_' + zoneId,
      time: new Date().toLocaleTimeString('ru-RU'),
      zoneId,
      zoneName,
      type,
    };
    setEvents(prev => [...prev.slice(-99), event]); // keep last 100
  }, []);

  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !zones || zones.length === 0) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // Init canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = vw;
      canvasRef.current.height = vh;
      ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    // Resize if needed
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
      prevFrameRef.current = null;
    }

    // Draw current frame
    ctx.drawImage(video, 0, 0, vw, vh);
    const currentFrame = ctx.getImageData(0, 0, vw, vh);

    if (!prevFrameRef.current) {
      prevFrameRef.current = currentFrame;
      return;
    }

    const prevData = prevFrameRef.current.data;
    const currData = currentFrame.data;

    // Check each zone
    for (const zone of zones) {
      const { x, y, w, h } = zone.rect;
      // Scale zone coordinates to video resolution
      const zx = Math.max(0, Math.round(x));
      const zy = Math.max(0, Math.round(y));
      const zw = Math.min(vw - zx, Math.round(w));
      const zh = Math.min(vh - zy, Math.round(h));

      if (zw <= 0 || zh <= 0) continue;

      let changedPixels = 0;
      const totalPixels = zw * zh;
      // Sample every 4th pixel for performance
      const step = 4;

      for (let row = zy; row < zy + zh; row += step) {
        for (let col = zx; col < zx + zw; col += step) {
          const idx = (row * vw + col) * 4;
          const dr = Math.abs(currData[idx] - prevData[idx]);
          const dg = Math.abs(currData[idx + 1] - prevData[idx + 1]);
          const db = Math.abs(currData[idx + 2] - prevData[idx + 2]);
          const diff = (dr + dg + db) / 3;
          if (diff > MOTION_THRESHOLD) {
            changedPixels++;
          }
        }
      }

      const sampledTotal = Math.ceil(totalPixels / (step * step));
      const pct = changedPixels / sampledTotal;

      if (pct > ZONE_MOTION_PCT / 100) {
        addEvent(zone.zoneId, zone.zoneName, 'motion');
      }
    }

    prevFrameRef.current = currentFrame;
  }, [videoRef, zones, addEvent]);

  useEffect(() => {
    if (!enabled || !zones || zones.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(detectMotion, DETECTION_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, zones, detectMotion]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, clearEvents };
}
