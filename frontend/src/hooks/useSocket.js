import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

let socket = null;
let connectionListeners = new Set();

// Notify all listeners when connection status changes
function notifyConnectionChange(connected) {
  connectionListeners.forEach(fn => fn(connected));
}

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) return socket;

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  // On preview proxy (dev.metricsavto.com), Socket.IO not available — skip
  if (!isLocal) {
    console.log('[Socket.IO] Skipped on preview proxy (use polling fallback)');
    return null;
  }

  socket = io(`http://${host}:3001`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket.id);
    socket.emit('subscribe:all');
    notifyConnectionChange(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected:', reason);
    notifyConnectionChange(false);
  });

  socket.on('connect_error', (err) => {
    console.log('[Socket.IO] Connection error:', err.message);
    notifyConnectionChange(false);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    notifyConnectionChange(false);
  }
}

// Hook: connection status
export function useSocketStatus() {
  const [connected, setConnected] = useState(socket?.connected || false);

  useEffect(() => {
    const handler = (c) => setConnected(c);
    connectionListeners.add(handler);
    setConnected(socket?.connected || false);
    return () => connectionListeners.delete(handler);
  }, []);

  return connected;
}

// Hook: listen to a Socket.IO event
export function useSocket(event, callback) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = (...args) => savedCallback.current(...args);
    s.on(event, handler);
    return () => s.off(event, handler);
  }, [event]);
}

// Hook: subscribe to zone/post updates
export function useSubscribe(channel) {
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    if (channel.startsWith('zone:')) s.emit('subscribe:zone', channel.replace('zone:', ''));
    else if (channel.startsWith('post:')) s.emit('subscribe:post', channel.replace('post:', ''));
  }, [channel]);
}

// Polling fallback — used when socket is disconnected or for data that doesn't have WS events
export function usePolling(callback, intervalMs = 5000) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const tick = () => savedCallback.current();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
