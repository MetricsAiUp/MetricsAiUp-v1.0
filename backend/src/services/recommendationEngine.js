const prisma = require('../config/database');
const { getIO } = require('../config/socket');

/**
 * Проверяет условия для формирования рекомендаций
 */
async function checkRecommendations(zoneId, postId) {
  const checks = [];

  if (postId) {
    checks.push(checkPostFree(postId));
    checks.push(checkWorkOvertime(postId));
    checks.push(checkVehicleIdle(postId));
  }

  if (zoneId) {
    checks.push(checkCapacityAvailable(zoneId));
  }

  checks.push(checkNoShow());

  await Promise.all(checks);
}

// Пост свободен долго
async function checkPostFree(postId) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== 'free') return;

  const lastStay = await prisma.postStay.findFirst({
    where: { postId },
    orderBy: { endTime: 'desc' },
  });

  if (lastStay?.endTime) {
    const idleMinutes = (Date.now() - lastStay.endTime.getTime()) / 60000;
    if (idleMinutes > 30) {
      await createRecommendation('post_free', null, postId,
        `Пост "${post.name}" свободен более ${Math.round(idleMinutes)} минут`,
        `Post "${post.name}" has been free for over ${Math.round(idleMinutes)} minutes`);
    }
  }
}

// Работа затянулась
async function checkWorkOvertime(postId) {
  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null },
    include: {
      vehicleSession: {
        include: { workOrderLinks: { include: { workOrder: true } } },
      },
    },
  });

  if (!stay) return;

  const links = stay.vehicleSession?.workOrderLinks || [];
  for (const link of links) {
    const wo = link.workOrder;
    if (!wo.normHours) continue;

    const elapsed = (Date.now() - stay.startTime.getTime()) / 3600000;
    if (elapsed > wo.normHours * 1.2) {
      await createRecommendation('work_overtime', null, postId,
        `Работа на посту превышает норму: ${elapsed.toFixed(1)}ч из ${wo.normHours}ч`,
        `Work on post exceeds norm: ${elapsed.toFixed(1)}h of ${wo.normHours}h`);
    }
  }
}

// Авто стоит без работ
async function checkVehicleIdle(postId) {
  const stay = await prisma.postStay.findFirst({
    where: { postId, endTime: null, hasWorker: false },
  });

  if (stay) {
    const idleMinutes = (Date.now() - stay.startTime.getTime()) / 60000;
    if (idleMinutes > 15) {
      await createRecommendation('vehicle_idle', null, postId,
        `Авто на посту без работника более ${Math.round(idleMinutes)} минут`,
        `Vehicle on post without worker for over ${Math.round(idleMinutes)} minutes`);
    }
  }
}

// Есть свободная мощность
async function checkCapacityAvailable(zoneId) {
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: { posts: { where: { isActive: true } } },
  });
  if (!zone) return;

  const freePosts = zone.posts.filter((p) => p.status === 'free');
  const totalPosts = zone.posts.length;

  if (totalPosts > 0 && freePosts.length / totalPosts > 0.5) {
    await createRecommendation('capacity_available', zoneId, null,
      `Зона "${zone.name}": ${freePosts.length} из ${totalPosts} постов свободны`,
      `Zone "${zone.name}": ${freePosts.length} of ${totalPosts} posts are free`);
  }
}

// Клиент не приехал
async function checkNoShow() {
  const threshold = new Date();
  threshold.setMinutes(threshold.getMinutes() - 30);

  const noShows = await prisma.workOrder.findMany({
    where: {
      status: 'scheduled',
      scheduledTime: { lt: threshold },
    },
  });

  for (const wo of noShows) {
    await prisma.workOrder.update({
      where: { id: wo.id },
      data: { status: 'no_show' },
    });

    await createRecommendation('no_show', null, null,
      `Клиент не приехал: ЗН ${wo.orderNumber} (запись на ${wo.scheduledTime.toLocaleTimeString('ru')})`,
      `Client no-show: WO ${wo.orderNumber} (scheduled at ${wo.scheduledTime.toLocaleTimeString('en')})`);
  }
}

// Создание рекомендации (без дублей)
async function createRecommendation(type, zoneId, postId, message, messageEn) {
  const existing = await prisma.recommendation.findFirst({
    where: { type, zoneId, postId, status: 'active' },
  });

  if (existing) return existing;

  const rec = await prisma.recommendation.create({
    data: { type, zoneId, postId, message },
  });

  try {
    const io = getIO();
    io.to('all_events').emit('recommendation', { ...rec, messageEn: messageEn || message });
  } catch {}

  return rec;
}

module.exports = { checkRecommendations };
