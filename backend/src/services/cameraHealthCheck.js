const { getIO } = require('../config/socket');

const statusMap = new Map();

async function checkCamera(camId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`http://localhost:8181/api/stream/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return data[camId]?.streaming || false;
    }
    return false;
  } catch {
    return false;
  }
}

function startCameraHealthCheck() {
  const CAM_IDS = Array.from({ length: 10 }, (_, i) => `cam${String(i + 1).padStart(2, '0')}`);
  const check = async () => {
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
