import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({ autoConnect: false });
  }
  return socket;
}

export function useSocket(event, callback) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();

    const handler = (...args) => savedCallback.current(...args);
    s.on(event, handler);

    return () => {
      s.off(event, handler);
    };
  }, [event]);
}

export function useSubscribe(channel) {
  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();
    s.emit(`subscribe:${channel}`);
  }, [channel]);
}
