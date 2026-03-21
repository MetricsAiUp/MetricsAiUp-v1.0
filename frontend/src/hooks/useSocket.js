import { useEffect, useRef } from 'react';

// Socket.IO disabled — using polling via static JSON API
// These hooks are no-ops to prevent errors

export function getSocket() {
  return null;
}

export function useSocket(event, callback) {
  // No-op — polling handles updates
}

export function useSubscribe(channel) {
  // No-op — polling handles updates
}

// Polling hook — refetch data every N seconds
export function usePolling(callback, intervalMs = 5000) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const tick = () => savedCallback.current();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
