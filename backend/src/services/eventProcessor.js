const prisma = require('../config/database');
const { getIO } = require('../config/socket');
const { checkRecommendations } = require('./recommendationEngine');

/**
 * Обрабатывает событие от CV-системы
 * Входной формат:
 * {
 *   event_type: "post_occupied",
 *   zone_id: "zone_03",
 *   post_id: "post_06",
 *   vehicle_track_id: "abc123",
 *   timestamp: "...",
 *   confidence: 0.87,
 *   camera_sources: ["cam07", "cam04"],
 *   plate_number: "A123BC" (optional)
 * }
 */
async function processEvent(data) {
  const {
    event_type,
    zone_id,
    post_id,
    vehicle_track_id,
    timestamp,
    confidence = 0,
    camera_sources = [],
    plate_number,
  } = data;

  // Найти или создать сессию авто по track_id
  let vehicleSession = null;
  if (vehicle_track_id) {
    vehicleSession = await findOrCreateSession(vehicle_track_id, plate_number);
  }

  // Создать запись события
  const event = await prisma.event.create({
    data: {
      type: event_type,
      zoneId: zone_id,
      postId: post_id || null,
      vehicleSessionId: vehicleSession?.id || null,
      cameraSources: camera_sources,
      confidence,
      startTime: timestamp ? new Date(timestamp) : new Date(),
      rawData: data,
    },
  });

  // Обработка по типу события
  switch (event_type) {
    case 'vehicle_entered_zone':
      await handleVehicleEnteredZone(zone_id, vehicleSession);
      break;
    case 'vehicle_left_zone':
      await handleVehicleLeftZone(zone_id, vehicleSession);
      break;
    case 'post_occupied':
      await handlePostOccupied(zone_id, post_id, vehicleSession);
      break;
    case 'post_vacated':
      await handlePostVacated(post_id, vehicleSession);
      break;
    case 'worker_present':
      await handleWorkerPresent(post_id);
      break;
    case 'worker_absent':
      await handleWorkerAbsent(post_id);
      break;
    case 'work_activity':
      await handleWorkActivity(post_id);
      break;
    case 'work_idle':
      await handleWorkIdle(post_id);
      break;
  }

  // Проверить рекомендации
  await checkRecommendations(zone_id, post_id);

  // Отправить через Socket.IO
  emitEvent(event, zone_id, post_id);

  return event;
}

// --- Обработчики событий ---

async function findOrCreateSession(trackId, plateNumber) {
  let session = await prisma.vehicleSession.findFirst({
    where: { trackId, status: 'active' },
  });

  if (!session) {
    session = await prisma.vehicleSession.create({
      data: {
        trackId,
        plateNumber: plateNumber || null,
      },
    });
  } else if (plateNumber && !session.plateNumber) {
    session = await prisma.vehicleSession.update({
      where: { id: session.id },
      data: { plateNumber },
    });
  }

  return session;
}

async function handleVehicleEnteredZone(zoneId, session) {
  if (!session) return;

  await prisma.zoneStay.create({
    data: {
      zoneId,
      vehicleSessionId: session.id,
    },
  });
}

async function handleVehicleLeftZone(zoneId, session) {
  if (!session) return;

  const stay = await prisma.zoneStay.findFirst({
    where: { zoneId, vehicleSessionId: session.id, exitTime: null },
    orderBy: { entryTime: 'desc' },
  });

  if (stay) {
    const now = new Date();
    const duration = Math.round((now - stay.entryTime) / 1000);
    await prisma.zoneStay.update({
      where: { id: stay.id },
      data: { exitTime: now, duration },
    });
  }
}

async function handlePostOccupied(zoneId, postId, session) {
  if (!postId) return;

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'occupied' },
  });

  if (session) {
    await prisma.postStay.create({
      data: {
        postId,
        vehicleSessionId: session.id,
      },
    });
  }
}

async function handlePostVacated(postId, session) {
  if (!postId) return;

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'free' },
  });

  if (session) {
    const stay = await prisma.postStay.findFirst({
      where: { postId, vehicleSessionId: session.id, endTime: null },
      orderBy: { startTime: 'desc' },
    });

    if (stay) {
      const now = new Date();
      await prisma.postStay.update({
        where: { id: stay.id },
        data: { endTime: now },
      });
    }
  }
}

async function handleWorkerPresent(postId) {
  if (!postId) return;

  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null },
    orderBy: { startTime: 'desc' },
  });

  if (stay) {
    await prisma.postStay.update({
      where: { id: stay.id },
      data: { hasWorker: true },
    });
  }
}

async function handleWorkerAbsent(postId) {
  if (!postId) return;

  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null },
    orderBy: { startTime: 'desc' },
  });

  if (stay) {
    await prisma.postStay.update({
      where: { id: stay.id },
      data: { hasWorker: false },
    });
  }

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'occupied_no_work' },
  });
}

async function handleWorkActivity(postId) {
  if (!postId) return;

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'active_work' },
  });

  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null },
    orderBy: { startTime: 'desc' },
  });

  if (stay) {
    await prisma.postStay.update({
      where: { id: stay.id },
      data: { isActive: true },
    });
  }
}

async function handleWorkIdle(postId) {
  if (!postId) return;

  await prisma.post.update({
    where: { id: postId },
    data: { status: 'occupied_no_work' },
  });

  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null },
    orderBy: { startTime: 'desc' },
  });

  if (stay) {
    await prisma.postStay.update({
      where: { id: stay.id },
      data: { isActive: false },
    });
  }
}

// --- Socket.IO emit ---

function emitEvent(event, zoneId, postId) {
  try {
    const io = getIO();
    io.to('all_events').emit('event', event);
    if (zoneId) io.to(`zone:${zoneId}`).emit('zone:update', event);
    if (postId) io.to(`post:${postId}`).emit('post:update', event);
  } catch (err) {
    // Socket.IO not initialized yet — skip
  }
}

module.exports = { processEvent };
