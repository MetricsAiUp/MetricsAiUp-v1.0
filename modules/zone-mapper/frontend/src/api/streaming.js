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
  { id: 'cam00', name: 'CAM 00 — Шлагбаум' },
  { id: 'cam01', name: 'CAM 01 — Стоянка' },
  { id: 'cam02', name: 'CAM 02 — Ворота + пост 07,08' },
  { id: 'cam03', name: 'CAM 03 — Пост 07,08' },
  { id: 'cam04', name: 'CAM 04 — Пост 09,08,07' },
  { id: 'cam05', name: 'CAM 05 — Пост 10 + с.зона 07' },
  { id: 'cam06', name: 'CAM 06 — Склад приёмки' },
  { id: 'cam07', name: 'CAM 07 — Склад деталей' },
  { id: 'cam08', name: 'CAM 08 — Пост 06,05 + с.зона 06,05' },
  { id: 'cam09', name: 'CAM 09 — С.зона 06 + пост 05' },
  { id: 'cam10', name: 'CAM 10 — С.зона 05,04,06' },
  { id: 'cam11', name: 'CAM 11 — Пост 02 + с.зона 04,05' },
  { id: 'cam12', name: 'CAM 12 — Пост 01,02' },
  { id: 'cam13', name: 'CAM 13 — Пост 05,04' },
  { id: 'cam14', name: 'CAM 14 — Пост 03,04 + с.зона 03' },
  { id: 'cam15', name: 'CAM 15 — С.зона 01' },
];

export const startStream = (camId) => streamApi.post(`/api/stream/start/${camId}`).then(r => r.data);
export const stopStream = (camId) => streamApi.post(`/api/stream/stop/${camId}`).then(r => r.data);
export const getStreamStatus = () => streamApi.get('/api/stream/status').then(r => r.data);

export const getHlsUrl = (camId) => {
  const base = getStreamBase();
  return `${base}/hls/${camId}/stream.m3u8`;
};

export const getSnapshotUrl = (camId) => {
  const base = getStreamBase();
  return `${base}/api/stream/snapshot/${camId}`;
};

export const getCropUrl = (camId, rect, frameW = 1920, frameH = 1080) => {
  const base = getStreamBase();
  return `${base}/api/stream/snapshot/${camId}/crop?x=${rect.x}&y=${rect.y}&w=${rect.w}&h=${rect.h}&fw=${frameW}&fh=${frameH}`;
};

// Motion detection API (port 8182)
const getMotionBase = () => {
  const match = window.location.pathname.match(/^(\/p\/[^/]+)\//);
  if (match) return `${match[1]}/8182`;
  return 'http://localhost:8182';
};

const motionApi = axios.create({ baseURL: getMotionBase() });

export const startMotion = (camId, config) => motionApi.post(`/api/motion/start/${camId}`, config).then(r => r.data);
export const stopMotion = (camId) => motionApi.post(`/api/motion/stop/${camId}`).then(r => r.data);
export const getMotionStatus = () => motionApi.get('/api/motion/status').then(r => r.data);
export const getMotionEvents = (camId) => motionApi.get(`/api/motion/events/${camId}`).then(r => r.data);

export const getMotionSSEUrl = () => {
  const base = getMotionBase();
  return `${base}/api/motion/events`;
};
