const { getIO } = require('../config/socket');
const logger = require('../config/logger');
const registry = require('./_serviceRegistry');

const EXTERNAL_STREAM_API = 'https://dev.metricsavto.com/p/test1/8181';
const CAM_IDS = Array.from({ length: 16 }, (_, i) => `cam${String(i).padStart(2, '0')}`);
const statusMap = new Map();

// Check camera by trying snapshot (200 = online, anything else = offline)
async function checkCamera(camId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${EXTERNAL_STREAM_API}/api/stream/snapshot/${camId}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function startCameraHealthCheck() {
  registry.register('cameraHealthCheck', { interval: 30000, cameras: CAM_IDS.length });
  const check = async () => {
    try {
      for (const camId of CAM_IDS) {
        const online = await checkCamera(camId);
        const prev = statusMap.get(camId);
        statusMap.set(camId, { online, lastCheck: new Date() });
        if (!prev || prev.online !== online) {
          try {
            getIO()?.to('all_events').emit('camera:status', { camId, online });
          } catch {}
        }
      }
      registry.tick('cameraHealthCheck');
    } catch (err) {
      registry.error('cameraHealthCheck', err);
    }
  };
  check();
  setInterval(check, 30000);
}

function getCameraStatuses() {
  const result = {};
  statusMap.forEach((v, k) => { result[k] = v; });
  return result;
}

module.exports = { startCameraHealthCheck, getCameraStatuses };
