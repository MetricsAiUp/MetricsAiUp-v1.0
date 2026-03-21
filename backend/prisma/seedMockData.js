const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const now = new Date();
const h = (hours) => new Date(now.getTime() - hours * 3600000);
const m = (mins) => new Date(now.getTime() - mins * 60000);

async function main() {
  console.log('Cleaning old data...');
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

  // ======= ЗОНЫ =======
  const [z1, z2, z3, z4, z5] = await Promise.all([
    prisma.zone.create({ data: { name: 'Зона 01 — Въезд/Выезд', type: 'entry', description: 'Въезд и выезд с территории СТО' } }),
    prisma.zone.create({ data: { name: 'Зона 02 — Ожидание', type: 'waiting', description: 'Зона ожидания перед постановкой на пост' } }),
    prisma.zone.create({ data: { name: 'Зона 03 — Ремонт (основная)', type: 'repair', description: 'Основная ремзона, посты 01-05' } }),
    prisma.zone.create({ data: { name: 'Зона 04 — Ремонт (доп.)', type: 'repair', description: 'Доп. ремзона, посты 06-07' } }),
    prisma.zone.create({ data: { name: 'Зона 05 — Парковка', type: 'parking', description: 'Готовые авто, ожидание выдачи' } }),
  ]);
  console.log('5 zones');

  // ======= ПОСТЫ =======
  const [p1, p2, p3, p4, p5, p6, p7] = await Promise.all([
    prisma.post.create({ data: { zoneId: z3.id, name: 'Пост 01', type: 'light', status: 'active_work' } }),
    prisma.post.create({ data: { zoneId: z3.id, name: 'Пост 02', type: 'light', status: 'occupied_no_work' } }),
    prisma.post.create({ data: { zoneId: z3.id, name: 'Пост 03', type: 'light', status: 'active_work' } }),
    prisma.post.create({ data: { zoneId: z3.id, name: 'Пост 04', type: 'heavy', status: 'occupied' } }),
    prisma.post.create({ data: { zoneId: z3.id, name: 'Пост 05', type: 'light', status: 'free' } }),
    prisma.post.create({ data: { zoneId: z4.id, name: 'Пост 06', type: 'light', status: 'active_work' } }),
    prisma.post.create({ data: { zoneId: z4.id, name: 'Пост 07', type: 'special', status: 'free' } }),
  ]);
  console.log('7 posts');

  // ======= КАМЕРЫ =======
  const cams = await Promise.all([
    prisma.camera.create({ data: { name: 'CAM 01 (новая)', rtspUrl: 'rtsp://cam01' } }),
    prisma.camera.create({ data: { name: 'CAM 02 (новая)', rtspUrl: 'rtsp://cam02' } }),
    prisma.camera.create({ data: { name: 'CAM 03 (новая)', rtspUrl: 'rtsp://cam03' } }),
    prisma.camera.create({ data: { name: 'CAM 04 (новая)', rtspUrl: 'rtsp://cam04' } }),
    prisma.camera.create({ data: { name: 'CAM 05 — 3.4 СТО', rtspUrl: 'rtsp://cam05' } }),
    prisma.camera.create({ data: { name: 'CAM 06 — 3.6 СТО', rtspUrl: 'rtsp://cam06' } }),
    prisma.camera.create({ data: { name: 'CAM 07 — 3.2 СТО', rtspUrl: 'rtsp://cam07' } }),
    prisma.camera.create({ data: { name: 'CAM 08 — 3.3 СТО', rtspUrl: 'rtsp://cam08' } }),
    prisma.camera.create({ data: { name: 'CAM 09 — 3.1 СТО', rtspUrl: 'rtsp://cam09' } }),
    prisma.camera.create({ data: { name: 'CAM 10 — 3.7 Склад', rtspUrl: 'rtsp://cam10' } }),
  ]);
  console.log('10 cameras');

  // Camera-Zone links
  for (const cam of cams.slice(0, 4)) await prisma.cameraZone.create({ data: { cameraId: cam.id, zoneId: z3.id, priority: 10 } });
  for (const cam of cams.slice(4, 8)) await prisma.cameraZone.create({ data: { cameraId: cam.id, zoneId: z3.id, priority: 5 } });
  await prisma.cameraZone.create({ data: { cameraId: cams[2].id, zoneId: z4.id, priority: 8 } });
  await prisma.cameraZone.create({ data: { cameraId: cams[3].id, zoneId: z4.id, priority: 8 } });
  await prisma.cameraZone.create({ data: { cameraId: cams[8].id, zoneId: z1.id, priority: 10 } });
  await prisma.cameraZone.create({ data: { cameraId: cams[9].id, zoneId: z5.id, priority: 10 } });

  // ======= СЕССИИ АВТО (8 активных + 4 завершённых) =======
  const plates = ['А123ВС77', 'В456КМ50', 'Е789ОР77', 'Х999ХХ77', 'М777ММ97', 'К111АА99', 'О222НН50', 'Р333УУ77', 'С444ЕЕ99', 'Т555ТТ50', 'У666АА77', 'Н888ВВ97'];
  const tracks = plates.map((_, i) => `track_${String(i + 1).padStart(3, '0')}`);

  // Active sessions
  const s = [];
  for (let i = 0; i < 8; i++) {
    s.push(await prisma.vehicleSession.create({
      data: { plateNumber: plates[i], trackId: tracks[i], status: 'active', entryTime: h(3 - i * 0.3) },
    }));
  }
  // Completed sessions
  for (let i = 8; i < 12; i++) {
    s.push(await prisma.vehicleSession.create({
      data: { plateNumber: plates[i], trackId: tracks[i], status: 'completed', entryTime: h(8 - i * 0.5), exitTime: h(2) },
    }));
  }
  console.log('12 sessions (8 active, 4 completed)');

  // ======= ZONE STAYS =======
  // 3 авто в зоне ремонта 03
  await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[0].id, entryTime: h(2.5) } });
  await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[1].id, entryTime: h(2) } });
  await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[2].id, entryTime: h(1.5) } });
  await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[3].id, entryTime: h(1) } });
  // 1 авто в зоне 04
  await prisma.zoneStay.create({ data: { zoneId: z4.id, vehicleSessionId: s[4].id, entryTime: h(1.2) } });
  // 2 авто в ожидании
  await prisma.zoneStay.create({ data: { zoneId: z2.id, vehicleSessionId: s[5].id, entryTime: m(40) } });
  await prisma.zoneStay.create({ data: { zoneId: z2.id, vehicleSessionId: s[6].id, entryTime: m(15) } });
  // 1 на парковке
  await prisma.zoneStay.create({ data: { zoneId: z5.id, vehicleSessionId: s[7].id, entryTime: m(25) } });
  // Completed zone stays
  for (let i = 8; i < 12; i++) {
    await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[i].id, entryTime: h(6), exitTime: h(2), duration: 14400 } });
  }

  // ======= POST STAYS =======
  // Пост 01 — активная работа, А123ВС77
  await prisma.postStay.create({ data: { postId: p1.id, vehicleSessionId: s[0].id, startTime: h(2.3), hasWorker: true, isActive: true, activeTime: 7200, idleTime: 600 } });
  // Пост 02 — простой, В456КМ50 (авто есть, работника нет)
  await prisma.postStay.create({ data: { postId: p2.id, vehicleSessionId: s[1].id, startTime: h(1.8), hasWorker: false, isActive: false, activeTime: 1800, idleTime: 3600 } });
  // Пост 03 — активная работа, Е789ОР77
  await prisma.postStay.create({ data: { postId: p3.id, vehicleSessionId: s[2].id, startTime: h(1.3), hasWorker: true, isActive: true, activeTime: 4200, idleTime: 300 } });
  // Пост 04 — занят, Х999ХХ77 (грузовик, диагностика)
  await prisma.postStay.create({ data: { postId: p4.id, vehicleSessionId: s[3].id, startTime: h(0.8), hasWorker: true, isActive: false, activeTime: 900, idleTime: 1200 } });
  // Пост 06 — активная работа, М777ММ97
  await prisma.postStay.create({ data: { postId: p6.id, vehicleSessionId: s[4].id, startTime: h(1), hasWorker: true, isActive: true, activeTime: 3000, idleTime: 200 } });

  console.log('5 active post stays');

  // ======= ЗАКАЗ-НАРЯДЫ (10 шт) =======
  const woData = [
    { ext: '1C-001', num: 'ЗН-2026-0301', time: h(3), status: 'in_progress', plate: 'А123ВС77', type: 'ТО-2', norm: 3.0, actual: 2.3 },
    { ext: '1C-002', num: 'ЗН-2026-0302', time: h(2.5), status: 'in_progress', plate: 'В456КМ50', type: 'Замена тормозных колодок', norm: 1.5, actual: null },
    { ext: '1C-003', num: 'ЗН-2026-0303', time: h(1.5), status: 'in_progress', plate: 'Е789ОР77', type: 'Диагностика ходовой', norm: 1.0, actual: null },
    { ext: '1C-004', num: 'ЗН-2026-0304', time: h(1), status: 'in_progress', plate: 'Х999ХХ77', type: 'Диагностика двигателя (грузовой)', norm: 2.0, actual: null },
    { ext: '1C-005', num: 'ЗН-2026-0305', time: h(1.2), status: 'in_progress', plate: 'М777ММ97', type: 'Кузовной ремонт', norm: 8.0, actual: null },
    { ext: '1C-006', num: 'ЗН-2026-0306', time: h(0.5), status: 'scheduled', plate: 'О222НН50', type: 'Замена масла', norm: 0.5, actual: null },
    { ext: '1C-007', num: 'ЗН-2026-0307', time: h(-1), status: 'scheduled', plate: 'Р333УУ77', type: 'Шиномонтаж', norm: 1.0, actual: null },
    { ext: '1C-008', num: 'ЗН-2026-0308', time: h(5), status: 'no_show', plate: 'К111АА99', type: 'Замена сцепления', norm: 4.0, actual: null },
    { ext: '1C-009', num: 'ЗН-2026-0309', time: h(7), status: 'completed', plate: 'С444ЕЕ99', type: 'Замена ремня ГРМ', norm: 3.5, actual: 3.2 },
    { ext: '1C-010', num: 'ЗН-2026-0310', time: h(8), status: 'completed', plate: 'Т555ТТ50', type: 'Покраска бампера', norm: 6.0, actual: 5.5 },
  ];

  const wos = [];
  for (const w of woData) {
    wos.push(await prisma.workOrder.create({
      data: {
        externalId: w.ext, orderNumber: w.num, scheduledTime: w.time,
        status: w.status, plateNumber: w.plate, workType: w.type,
        normHours: w.norm, actualHours: w.actual,
      },
    }));
  }
  console.log('10 work orders');

  // Связки ЗН → сессии
  for (let i = 0; i < 5; i++) {
    await prisma.workOrderLink.create({
      data: { vehicleSessionId: s[i].id, workOrderId: wos[i].id, confidence: 0.9 + Math.random() * 0.1, matchType: 'plate' },
    });
  }

  // ======= СОБЫТИЯ (30 шт — разных типов) =======
  const eventTypes = [
    'vehicle_entered_zone', 'vehicle_entered_zone', 'vehicle_entered_zone',
    'vehicle_left_zone', 'vehicle_left_zone',
    'vehicle_moving', 'vehicle_moving', 'vehicle_waiting', 'vehicle_waiting',
    'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied',
    'post_vacated', 'post_vacated',
    'worker_present', 'worker_present', 'worker_present', 'worker_present',
    'worker_absent', 'worker_absent',
    'work_activity', 'work_activity', 'work_activity', 'work_activity',
    'work_idle', 'work_idle', 'work_idle', 'work_idle',
  ];
  const postIds = [p1.id, p2.id, p3.id, p4.id, p5.id, p6.id, p7.id];
  const zoneIds = [z1.id, z2.id, z3.id, z3.id, z4.id];

  for (let i = 0; i < 30; i++) {
    const eType = eventTypes[i];
    const needsPost = !eType.includes('zone') && !eType.includes('moving') && !eType.includes('waiting');
    await prisma.event.create({
      data: {
        type: eType,
        zoneId: zoneIds[i % zoneIds.length],
        postId: needsPost ? postIds[i % postIds.length] : null,
        vehicleSessionId: s[i % 8].id,
        cameraSources: JSON.stringify([`cam${String((i % 10) + 1).padStart(2, '0')}`]),
        confidence: 0.75 + Math.random() * 0.25,
        startTime: m(90 - i * 3),
        rawData: JSON.stringify({ mock: true }),
      },
    });
  }
  console.log('30 events');

  // ======= РЕКОМЕНДАЦИИ (6 шт) =======
  await prisma.recommendation.create({ data: { type: 'vehicle_idle', postId: p2.id, message: 'Авто В456КМ50 на Посту 02 без работника более 45 минут' } });
  await prisma.recommendation.create({ data: { type: 'no_show', message: 'Клиент не приехал: ЗН-2026-0308 (К111АА99), запись была 5 часов назад' } });
  await prisma.recommendation.create({ data: { type: 'capacity_available', zoneId: z4.id, message: 'Зона 04: Пост 07 свободен, можно принять ещё 1 авто' } });
  await prisma.recommendation.create({ data: { type: 'work_overtime', postId: p1.id, message: 'Работа на Посту 01 превышает норму: 2.3ч из 3.0ч (ТО-2)' } });
  await prisma.recommendation.create({ data: { type: 'post_free', postId: p5.id, message: 'Пост 05 свободен более 2 часов' } });
  await prisma.recommendation.create({ data: { type: 'vehicle_idle', postId: p4.id, message: 'Авто Х999ХХ77 на Посту 04 — диагностика завершена, авто не забирают' } });
  console.log('6 recommendations');

  console.log('\n✅ Mock data seeded!');
  console.log('  Zones: 5, Posts: 7, Cameras: 10');
  console.log('  Sessions: 12 (8 active, 4 completed)');
  console.log('  Work Orders: 10, Events: 30, Recommendations: 6');
}

main().catch(console.error).finally(() => prisma.$disconnect());
