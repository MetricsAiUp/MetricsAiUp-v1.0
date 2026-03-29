import axios from 'axios';

// Streaming API on the main camera server (port 8181)
// We use the platform proxy: /p/test1/8181/ or relative detection
const getStreamBase = () => {
  const match = window.location.pathname.match(/^(\/p\/[^/]+)\//);
  if (match) return `${match[1]}/8181`;
  return 'http://localhost:8181';
};

const streamApi = axios.create({ baseURL: getStreamBase() });

// Known RTSP cameras from the main server
export const RTSP_CAMERAS = [
  { id: 'cam01', name: 'CAM 01 — 3.5 СТО' },
  { id: 'cam02', name: 'CAM 02 — 3.11 СТО' },
  { id: 'cam03', name: 'CAM 03 — 3.9 СТО' },
  { id: 'cam04', name: 'CAM 04 — 3.10 СТО' },
  { id: 'cam05', name: 'CAM 05 — 3.4 СТО' },
  { id: 'cam06', name: 'CAM 06 — 3.6 СТО' },
  { id: 'cam07', name: 'CAM 07 — 3.2 СТО' },
  { id: 'cam08', name: 'CAM 08 — 3.3 СТО' },
  { id: 'cam09', name: 'CAM 09 — 3.1 СТО' },
  { id: 'cam10', name: 'CAM 10 — 3.7 Склад СТО' },
];

export const startStream = (camId) => streamApi.post(`/api/stream/start/${camId}`).then(r => r.data);
export const stopStream = (camId) => streamApi.post(`/api/stream/stop/${camId}`).then(r => r.data);
export const getStreamStatus = () => streamApi.get('/api/stream/status').then(r => r.data);

export const getHlsUrl = (camId) => {
  const base = getStreamBase();
  return `${base}/hls/${camId}/stream.m3u8`;
};
