import axios from 'axios';

const api = axios.create({
  baseURL: './api'
});

// Rooms
export const getRooms = () => api.get('/rooms').then(r => r.data);
export const getRoom = (id) => api.get(`/rooms/${id}`).then(r => r.data);
export const createRoom = (data) => api.post('/rooms', data).then(r => r.data);
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data).then(r => r.data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`).then(r => r.data);

// Zones
export const getZones = (roomId) => api.get(`/rooms/${roomId}/zones`).then(r => r.data);
export const createZone = (roomId, data) => api.post(`/rooms/${roomId}/zones`, data).then(r => r.data);
export const updateZone = (roomId, zoneId, data) => api.put(`/rooms/${roomId}/zones/${zoneId}`, data).then(r => r.data);
export const deleteZone = (roomId, zoneId) => api.delete(`/rooms/${roomId}/zones/${zoneId}`).then(r => r.data);

// Cameras
export const getCameras = (roomId) => api.get(`/rooms/${roomId}/cameras`).then(r => r.data);
export const createCamera = (roomId, data) => api.post(`/rooms/${roomId}/cameras`, data).then(r => r.data);
export const updateCamera = (roomId, camId, data) => api.put(`/rooms/${roomId}/cameras/${camId}`, data).then(r => r.data);
export const deleteCamera = (roomId, camId) => api.delete(`/rooms/${roomId}/cameras/${camId}`).then(r => r.data);

// Projection
export const getProjection = (roomId, camId) => api.get(`/rooms/${roomId}/cameras/${camId}/projection`).then(r => r.data);
export const exportConfig = (roomId, camId) => api.get(`/rooms/${roomId}/cameras/${camId}/export`).then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = (data) => api.put('/settings', data).then(r => r.data);

// Vision analysis
export const analyzeImage = (imageBase64, zoneName, zoneType) =>
  api.post('/analyze', { imageBase64, zoneName, zoneType }).then(r => r.data);

// Collector — send analysis results to DB
export const sendToCollector = (data) => api.post('/collector/result', data).then(r => r.data);
export const sendBulkToCollector = (results) => api.post('/collector/bulk', { results }).then(r => r.data);

// Monitoring — current state + history
export const getMonitoringState = () => api.get('/monitoring/state').then(r => r.data);

// Auto-poll
export const startAutoPoll = (intervalMs) => api.post('/autopoll/start', { intervalMs }).then(r => r.data);
export const stopAutoPoll = () => api.post('/autopoll/stop').then(r => r.data);
export const getAutoPollStatus = () => api.get('/autopoll/status').then(r => r.data);
export const runAutoPollOnce = () => api.post('/autopoll/once').then(r => r.data);

// Custom 2D zone overrides
export const getZones2d = (roomId, camId) => api.get(`/rooms/${roomId}/cameras/${camId}/zones2d`).then(r => r.data);
export const saveZones2d = (roomId, camId, zones2d) => api.put(`/rooms/${roomId}/cameras/${camId}/zones2d`, { zones2d }).then(r => r.data);
