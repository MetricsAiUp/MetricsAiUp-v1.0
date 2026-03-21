const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning old STO data...');
  await prisma.recommendation.deleteMany();
  await prisma.workOrderLink.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.postStay.deleteMany();
  await prisma.zoneStay.deleteMany();
  await prisma.event.deleteMany();
  await prisma.vehicleSession.deleteMany();
  await prisma.cameraZone.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.post.deleteMany();
  await prisma.zone.deleteMany();

  console.log('Seeding STO zones, posts, cameras...');

  // ==========================================
  // Зоны СТО
  // ==========================================
  const zones = await Promise.all([
    prisma.zone.create({
      data: {
        name: 'Зона 01 — Въезд/Выезд',
        type: 'entry',
        description: 'Зона въезда и выезда автомобилей на территорию СТО',
      },
    }),
    prisma.zone.create({
      data: {
        name: 'Зона 02 — Ожидание',
        type: 'waiting',
        description: 'Зона ожидания перед постановкой на пост',
      },
    }),
    prisma.zone.create({
      data: {
        name: 'Зона 03 — Ремонт (основная)',
        type: 'repair',
        description: 'Основная ремонтная зона с постами 01-05',
      },
    }),
    prisma.zone.create({
      data: {
        name: 'Зона 04 — Ремонт (дополнительная)',
        type: 'repair',
        description: 'Дополнительная ремонтная зона с постами 06-07. Плохо читаются номера',
      },
    }),
    prisma.zone.create({
      data: {
        name: 'Зона 05 — Парковка',
        type: 'parking',
        description: 'Парковка для готовых автомобилей и ожидающих выдачи',
      },
    }),
  ]);

  console.log(`Created ${zones.length} zones`);

  // ==========================================
  // Посты
  // ==========================================
  const zone03 = zones[2]; // Ремонт основная
  const zone04 = zones[3]; // Ремонт дополнительная

  const posts = await Promise.all([
    // Зона 03 — посты 01-05
    prisma.post.create({
      data: { zoneId: zone03.id, name: 'Пост 01', type: 'light', status: 'free' },
    }),
    prisma.post.create({
      data: { zoneId: zone03.id, name: 'Пост 02', type: 'light', status: 'free',
      },
    }),
    prisma.post.create({
      data: { zoneId: zone03.id, name: 'Пост 03', type: 'light', status: 'free',
      },
    }),
    prisma.post.create({
      data: { zoneId: zone03.id, name: 'Пост 04', type: 'heavy', status: 'free' },
    }),
    prisma.post.create({
      data: { zoneId: zone03.id, name: 'Пост 05', type: 'light', status: 'free',
      },
    }),
    // Зона 04 — посты 06-07
    prisma.post.create({
      data: { zoneId: zone04.id, name: 'Пост 06', type: 'light', status: 'free' },
    }),
    prisma.post.create({
      data: { zoneId: zone04.id, name: 'Пост 07', type: 'special', status: 'free',
      },
    }),
  ]);

  console.log(`Created ${posts.length} posts`);

  // ==========================================
  // Камеры (10 существующих + 4 новые из ТЗ)
  // ==========================================
  const cameras = await Promise.all([
    // Существующие камеры
    prisma.camera.create({ data: { name: 'CAM 01 (новая)', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/t8rFCkD7_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 02 (новая)', rtspUrl: '' } }),
    prisma.camera.create({ data: { name: 'CAM 03 (новая)', rtspUrl: '' } }),
    prisma.camera.create({ data: { name: 'CAM 04 (новая)', rtspUrl: '' } }),
    prisma.camera.create({ data: { name: 'CAM 05 — 3.4 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/NQ5s26a6_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 06 — 3.6 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/AAIy5dnR_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 07 — 3.2 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/k0HNWQDk_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 08 — 3.3 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/KRoX0tGZ_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 09 — 3.1 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/we4rvi8t_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 10 — 3.7 Склад СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/PxPU26jt_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 11 — 3.5 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1732/t8rFCkD7_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 12 — 3.9 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/RTHaqqOJ_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 13 — 3.10 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/Mn1PZPF0_m/' } }),
    prisma.camera.create({ data: { name: 'CAM 14 — 3.11 СТО', rtspUrl: 'rtsp://ubo:0L5HQx!qGuW%40T3FMI3y4k2@86.57.249.76:1832/w9fKX1CE_m/' } }),
  ]);

  console.log(`Created ${cameras.length} cameras`);

  // ==========================================
  // Привязка камер к зонам (CameraZone) с приоритетами
  // ==========================================

  // CAM 01 (новая) — закрывает Пост 03 (слепой)
  await prisma.cameraZone.create({ data: { cameraId: cameras[0].id, zoneId: zone03.id, priority: 10 } });

  // CAM 02 (новая) — вдоль стены, закрывает мертвую зону
  await prisma.cameraZone.create({ data: { cameraId: cameras[1].id, zoneId: zone03.id, priority: 5 } });

  // CAM 03 (новая) — зона 04 + пост 02
  await prisma.cameraZone.create({ data: { cameraId: cameras[2].id, zoneId: zone04.id, priority: 10 } });
  await prisma.cameraZone.create({ data: { cameraId: cameras[2].id, zoneId: zone03.id, priority: 3 } });

  // CAM 04 (новая) — пост 07 + люди
  await prisma.cameraZone.create({ data: { cameraId: cameras[3].id, zoneId: zone04.id, priority: 8 } });

  // Существующие камеры — привязка к зонам
  // CAM 05-09 → Зона 03
  for (let i = 4; i <= 8; i++) {
    await prisma.cameraZone.create({ data: { cameraId: cameras[i].id, zoneId: zone03.id, priority: 5 } });
  }

  // CAM 10 → Зона 05 (склад/парковка)
  await prisma.cameraZone.create({ data: { cameraId: cameras[9].id, zoneId: zones[4].id, priority: 10 } });

  // CAM 11-14 → разные зоны
  await prisma.cameraZone.create({ data: { cameraId: cameras[10].id, zoneId: zone03.id, priority: 5 } });
  await prisma.cameraZone.create({ data: { cameraId: cameras[11].id, zoneId: zone03.id, priority: 5 } });
  await prisma.cameraZone.create({ data: { cameraId: cameras[12].id, zoneId: zone04.id, priority: 5 } });
  await prisma.cameraZone.create({ data: { cameraId: cameras[13].id, zoneId: zones[1].id, priority: 5 } }); // Зона ожидания

  console.log('Camera-zone links created');

  // ==========================================
  // Тестовые заказ-наряды (как будто из 1С)
  // ==========================================
  const now = new Date();
  const workOrders = await Promise.all([
    prisma.workOrder.create({
      data: {
        externalId: '1C-001',
        orderNumber: 'ЗН-2026-0301',
        scheduledTime: new Date(now.getTime() - 2 * 3600000), // 2 часа назад
        status: 'in_progress',
        plateNumber: 'А123ВС77',
        workType: 'ТО-2',
        normHours: 3.0,
      },
    }),
    prisma.workOrder.create({
      data: {
        externalId: '1C-002',
        orderNumber: 'ЗН-2026-0302',
        scheduledTime: new Date(now.getTime() - 1 * 3600000), // 1 час назад
        status: 'in_progress',
        plateNumber: 'В456КМ50',
        workType: 'Замена тормозных колодок',
        normHours: 1.5,
      },
    }),
    prisma.workOrder.create({
      data: {
        externalId: '1C-003',
        orderNumber: 'ЗН-2026-0303',
        scheduledTime: new Date(now.getTime() + 1 * 3600000), // через 1 час
        status: 'scheduled',
        plateNumber: 'Е789ОР77',
        workType: 'Диагностика ходовой',
        normHours: 1.0,
      },
    }),
    prisma.workOrder.create({
      data: {
        externalId: '1C-004',
        orderNumber: 'ЗН-2026-0304',
        scheduledTime: new Date(now.getTime() - 3 * 3600000), // 3 часа назад — no-show кандидат
        status: 'scheduled',
        plateNumber: 'К111АА99',
        workType: 'Замена масла',
        normHours: 0.5,
      },
    }),
    prisma.workOrder.create({
      data: {
        externalId: '1C-005',
        orderNumber: 'ЗН-2026-0305',
        scheduledTime: new Date(now.getTime() + 2 * 3600000),
        status: 'scheduled',
        plateNumber: 'М777ММ77',
        workType: 'Кузовной ремонт',
        normHours: 8.0,
      },
    }),
  ]);

  console.log(`Created ${workOrders.length} work orders`);

  // ==========================================
  // Тестовые сессии авто (имитация текущей работы)
  // ==========================================
  const session1 = await prisma.vehicleSession.create({
    data: {
      plateNumber: 'А123ВС77',
      trackId: 'track_001',
      status: 'active',
      entryTime: new Date(now.getTime() - 2 * 3600000),
    },
  });

  const session2 = await prisma.vehicleSession.create({
    data: {
      plateNumber: 'В456КМ50',
      trackId: 'track_002',
      status: 'active',
      entryTime: new Date(now.getTime() - 1 * 3600000),
    },
  });

  const session3 = await prisma.vehicleSession.create({
    data: {
      plateNumber: 'Х999ХХ77',
      trackId: 'track_003',
      status: 'active',
      entryTime: new Date(now.getTime() - 30 * 60000), // 30 мин назад
    },
  });

  console.log('Created 3 vehicle sessions');

  // Авто 1 → на Посту 01 (активная работа)
  await prisma.zoneStay.create({
    data: { zoneId: zone03.id, vehicleSessionId: session1.id, entryTime: new Date(now.getTime() - 2 * 3600000) },
  });
  await prisma.postStay.create({
    data: {
      postId: posts[0].id, vehicleSessionId: session1.id,
      startTime: new Date(now.getTime() - 110 * 60000),
      hasWorker: true, isActive: true, activeTime: 5400,
    },
  });
  await prisma.post.update({ where: { id: posts[0].id }, data: { status: 'active_work' } });

  // Авто 2 → на Посту 03 (занят без работы — простой)
  await prisma.zoneStay.create({
    data: { zoneId: zone03.id, vehicleSessionId: session2.id, entryTime: new Date(now.getTime() - 1 * 3600000) },
  });
  await prisma.postStay.create({
    data: {
      postId: posts[2].id, vehicleSessionId: session2.id,
      startTime: new Date(now.getTime() - 50 * 60000),
      hasWorker: false, isActive: false, idleTime: 1800,
    },
  });
  await prisma.post.update({ where: { id: posts[2].id }, data: { status: 'occupied_no_work' } });

  // Авто 3 → в Зоне ожидания
  await prisma.zoneStay.create({
    data: { zoneId: zones[1].id, vehicleSessionId: session3.id, entryTime: new Date(now.getTime() - 30 * 60000) },
  });

  console.log('Created zone stays, post stays, updated post statuses');

  // Связка ЗН с сессиями
  await prisma.workOrderLink.create({
    data: {
      vehicleSessionId: session1.id,
      workOrderId: workOrders[0].id,
      confidence: 0.95,
      matchType: 'plate',
    },
  });
  await prisma.workOrderLink.create({
    data: {
      vehicleSessionId: session2.id,
      workOrderId: workOrders[1].id,
      confidence: 0.90,
      matchType: 'plate',
    },
  });

  console.log('Linked work orders to sessions');

  // Рекомендации
  await prisma.recommendation.create({
    data: {
      type: 'vehicle_idle',
      postId: posts[2].id,
      message: 'Авто В456КМ50 на Посту 03 без работника более 30 минут',
    },
  });
  await prisma.recommendation.create({
    data: {
      type: 'no_show',
      message: 'Клиент не приехал: ЗН-2026-0304 (К111АА99), запись на ' + new Date(now.getTime() - 3 * 3600000).toLocaleTimeString('ru'),
    },
  });
  await prisma.recommendation.create({
    data: {
      type: 'capacity_available',
      zoneId: zone04.id,
      message: 'Зона 04: все посты свободны (2 из 2)',
    },
  });

  console.log('Created recommendations');
  console.log('\n✅ STO seed completed!');
  console.log('Summary:');
  console.log(`  Zones: ${zones.length}`);
  console.log(`  Posts: ${posts.length}`);
  console.log(`  Cameras: ${cameras.length}`);
  console.log(`  Work Orders: ${workOrders.length}`);
  console.log('  Vehicle Sessions: 3');
  console.log('  Recommendations: 3');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
