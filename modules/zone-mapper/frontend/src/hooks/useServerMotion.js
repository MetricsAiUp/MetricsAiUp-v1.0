import { useState, useEffect, useRef, useCallback } from 'react';
import { getMotionSSEUrl, getMotionEvents } from '../api/streaming';

/**
 * Hook to receive server-side motion events via SSE.
 * Optionally filter by camId.
 */
export default function useServerMotion(camId = null) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const url = getMotionSSEUrl();
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') return;
        if (camId && data.camId !== camId) return;
        setEvents(prev => [...prev.slice(-199), data]);
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
    };

    // Load existing events
    if (camId) {
      getMotionEvents(camId).then(evts => {
        if (evts && evts.length) setEvents(evts.slice(-100));
      }).catch(() => {});
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [camId]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}
