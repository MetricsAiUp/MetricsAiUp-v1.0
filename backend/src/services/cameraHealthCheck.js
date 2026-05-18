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

let checkTimer = null;
let checking = false;

function startCameraHealthCheck() {
  // Идемпотентный старт: повторный вызов не запускает второй setInterval.
  if (checkTimer) return;
  registry.register('cameraHealthCheck', { interval: 30000, cameras: CAM_IDS.length });
  const check = async () => {
    // Mutex: 16 камер × 5s timeout = до 80s в worst-case при тормозах CV API.
    // Без этого следующий tick (30s) накладывался на текущий, выдавая дубли
    // camera:status emit'ов в Socket.IO и копя in-flight fetch'и.
    if (checking) return;
    checking = true;
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
    } finally {
      checking = false;
    }
  };
  check();
  checkTimer = setInterval(check, 30000);
}

function stop() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
    logger.info('Camera health check stopped');
  }
}

function getCameraStatuses() {
  const result = {};
  statusMap.forEach((v, k) => { result[k] = v; });
  return result;
}

module.exports = { startCameraHealthCheck, getCameraStatuses, stop };
