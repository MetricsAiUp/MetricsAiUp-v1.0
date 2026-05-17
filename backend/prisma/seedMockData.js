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

  // ======= ЗОНЫ (1:1 с постами) =======
  const zonesArr = await Promise.all(
    Array.from({ length: 10 }, (_, i) => {
      const num = String(i + 1).padStart(2, '0');
      return prisma.zone.create({ data: { name: `Зона ${num}`, type: 'repair', description: `Пост ${num}` } });
    })
  );
  const [z1, z2, z3, z4, z5, z6, z7, z8, z9, z10] = zonesArr;
  console.log('10 zones');

  // ======= 10 ПОСТОВ (по реальной схеме) =======
  const POST_TYPES = ['heavy','heavy','heavy','heavy','light','light','light','light','special','special'];
  const POST_STATUSES = ['active_work','occupied_no_work','active_work','occupied','active_work','free','occupied','free','active_work','free'];
  const posts = await Promise.all(
    Array.from({ length: 10 }, (_, i) => prisma.post.create({
      data: {
        zoneId: zonesArr[i].id,
        name: `Пост ${i + 1}`,
        type: POST_TYPES[i],
        status: POST_STATUSES[i],
      },
    }))
  );
  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10] = posts;
  console.log('10 posts');

  // ======= КАМЕРЫ (10 шт) =======
  const cams = await Promise.all(
    Array.from({ length: 10 }, (_, i) => prisma.camera.create({
      data: { name: `CAM ${String(i + 1).padStart(2, '0')}`, rtspUrl: `rtsp://cam${i + 1}` },
    }))
  );
  // Привязка камер к зонам 1:1 (камера N → зона N)
  for (let i = 0; i < 10; i++) {
    await prisma.cameraZone.create({ data: { cameraId: cams[i].id, zoneId: zonesArr[i].id, priority: 10 } });
  }
  console.log('10 cameras');

  // ======= СЕССИИ АВТО (10 активных + 4 завершённых) =======
  const plates = ['А123ВС77', 'В456КМ50', 'Е789ОР77', 'Х999ХХ77', 'М777ММ97', 'К111АА99', 'О222НН50', 'Р333УУ77', 'С444ЕЕ99', 'Т555ТТ50', 'У666АА77', 'Н888ВВ97', 'АМ97745', 'ВН12377'];
  const s = [];
  for (let i = 0; i < 10; i++) {
    s.push(await prisma.vehicleSession.create({
      data: { plateNumber: plates[i], trackId: `track_${i + 1}`, status: 'active', entryTime: h(3.5 - i * 0.3) },
    }));
  }
  for (let i = 10; i < 14; i++) {
    s.push(await prisma.vehicleSession.create({
      data: { plateNumber: plates[i], trackId: `track_${i + 1}`, status: 'completed', entryTime: h(8), exitTime: h(2) },
    }));
  }
  console.log('14 sessions (10 active, 4 completed)');

  // ======= ZONE STAYS =======
  // Посты 1-4 (зона 3)
  for (let i = 0; i < 4; i++) await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[i].id, entryTime: h(2.5 - i * 0.3) } });
  // Посты 5,7 (зона 4)
  await prisma.zoneStay.create({ data: { zoneId: z4.id, vehicleSessionId: s[4].id, entryTime: h(1.8) } });
  await prisma.zoneStay.create({ data: { zoneId: z4.id, vehicleSessionId: s[5].id, entryTime: h(1.2) } });
  // Пост 9 (зона 5 — диагностика)
  await prisma.zoneStay.create({ data: { zoneId: z5.id, vehicleSessionId: s[6].id, entryTime: h(0.8) } });
  // Ожидание
  await prisma.zoneStay.create({ data: { zoneId: z2.id, vehicleSessionId: s[7].id, entryTime: m(40) } });
  await prisma.zoneStay.create({ data: { zoneId: z2.id, vehicleSessionId: s[8].id, entryTime: m(15) } });
  // Въезд
  await prisma.zoneStay.create({ data: { zoneId: z1.id, vehicleSessionId: s[9].id, entryTime: m(5) } });
  // Completed
  for (let i = 10; i < 14; i++) {
    await prisma.zoneStay.create({ data: { zoneId: z3.id, vehicleSessionId: s[i].id, entryTime: h(7), exitTime: h(2), duration: 18000 } });
  }

  // ======= POST STAYS (7 постов заняты) =======
  await prisma.postStay.create({ data: { postId: p1.id, vehicleSessionId: s[0].id, startTime: h(2.3), hasWorker: true, isActive: true, activeTime: 7200, idleTime: 600 } });
  await prisma.postStay.create({ data: { postId: p2.id, vehicleSessionId: s[1].id, startTime: h(1.8), hasWorker: false, isActive: false, activeTime: 1800, idleTime: 4200 } });
  await prisma.postStay.create({ data: { postId: p3.id, vehicleSessionId: s[2].id, startTime: h(1.3), hasWorker: true, isActive: true, activeTime: 4200, idleTime: 300 } });
  await prisma.postStay.create({ data: { postId: p4.id, vehicleSessionId: s[3].id, startTime: h(0.8), hasWorker: true, isActive: false, activeTime: 900, idleTime: 1200 } });
  await prisma.postStay.create({ data: { postId: p5.id, vehicleSessionId: s[4].id, startTime: h(1.5), hasWorker: true, isActive: true, activeTime: 5000, idleTime: 400 } });
  await prisma.postStay.create({ data: { postId: p7.id, vehicleSessionId: s[5].id, startTime: h(1), hasWorker: true, isActive: false, activeTime: 1200, idleTime: 2400 } });
  await prisma.postStay.create({ data: { postId: p9.id, vehicleSessionId: s[6].id, startTime: h(0.5), hasWorker: true, isActive: true, activeTime: 1800, idleTime: 0 } });
  console.log('7 post stays');

  // ======= ЗАКАЗ-НАРЯДЫ (12 шт) =======
  const woData = [
    { ext: '1C-001', num: 'ЗН-2026-0301', time: h(3), status: 'in_progress', plate: 'А123ВС77', type: 'ТО-2', norm: 3.0, actual: 2.3 },
    { ext: '1C-002', num: 'ЗН-2026-0302', time: h(2.5), status: 'in_progress', plate: 'В456КМ50', type: 'Замена тормозных колодок', norm: 1.5, actual: null },
    { ext: '1C-003', num: 'ЗН-2026-0303', time: h(1.5), status: 'in_progress', plate: 'Е789ОР77', type: 'Диагностика ходовой', norm: 1.0, actual: null },
    { ext: '1C-004', num: 'ЗН-2026-0304', time: h(1), status: 'in_progress', plate: 'Х999ХХ77', type: 'Диагностика двигателя', norm: 2.0, actual: null },
    { ext: '1C-005', num: 'ЗН-2026-0305', time: h(1.8), status: 'in_progress', plate: 'М777ММ97', type: 'Замена стоек', norm: 2.5, actual: null },
    { ext: '1C-006', num: 'ЗН-2026-0306', time: h(1.2), status: 'in_progress', plate: 'К111АА99', type: 'Замена масла + фильтры', norm: 1.0, actual: null },
    { ext: '1C-007', num: 'ЗН-2026-0307', time: h(0.5), status: 'in_progress', plate: 'О222НН50', type: 'Компьютерная диагностика', norm: 0.5, actual: null },
    { ext: '1C-008', num: 'ЗН-2026-0308', time: h(-1), status: 'scheduled', plate: 'Р333УУ77', type: 'Шиномонтаж', norm: 1.0, actual: null },
    { ext: '1C-009', num: 'ЗН-2026-0309', time: h(-2), status: 'scheduled', plate: 'unknown', type: 'ТО-1', norm: 2.0, actual: null },
    { ext: '1C-010', num: 'ЗН-2026-0310', time: h(5), status: 'no_show', plate: 'АВ55577', type: 'Замена сцепления', norm: 4.0, actual: null },
    { ext: '1C-011', num: 'ЗН-2026-0311', time: h(7), status: 'completed', plate: 'АМ97745', type: 'Замена ремня ГРМ', norm: 3.5, actual: 3.2 },
    { ext: '1C-012', num: 'ЗН-2026-0312', time: h(8), status: 'completed', plate: 'ВН12377', type: 'Покраска бампера', norm: 6.0, actual: 5.5 },
  ];
  const wos = [];
  for (const w of woData) {
    wos.push(await prisma.workOrder.create({
      data: { externalId: w.ext, orderNumber: w.num, scheduledTime: w.time, status: w.status, plateNumber: w.plate, workType: w.type, normHours: w.norm, actualHours: w.actual },
    }));
  }
  for (let i = 0; i < 7; i++) {
    await prisma.workOrderLink.create({
      data: { vehicleSessionId: s[i].id, workOrderId: wos[i].id, confidence: 0.85 + Math.random() * 0.15, matchType: 'plate' },
    });
  }
  console.log('12 work orders, 7 links');

  // ======= СОБЫТИЯ (35 шт) =======
  const eventTypes = [
    'vehicle_entered_zone', 'vehicle_entered_zone', 'vehicle_entered_zone', 'vehicle_entered_zone',
    'vehicle_left_zone', 'vehicle_left_zone',
    'vehicle_moving', 'vehicle_moving', 'vehicle_waiting', 'vehicle_waiting', 'vehicle_waiting',
    'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied', 'post_occupied',
    'post_vacated', 'post_vacated', 'post_vacated',
    'worker_present', 'worker_present', 'worker_present', 'worker_present', 'worker_present',
    'worker_absent', 'worker_absent',
    'work_activity', 'work_activity', 'work_activity', 'work_activity', 'work_activity',
    'work_idle', 'work_idle',
  ];
  const allPostIds = posts.map(p => p.id);
  const allZoneIds = [z1.id, z2.id, z3.id, z4.id, z5.id, z6.id, z7.id, z8.id, z9.id, z10.id];
  for (let i = 0; i < eventTypes.length; i++) {
    const eType = eventTypes[i];
    const needsPost = !eType.includes('zone') && !eType.includes('moving') && !eType.includes('waiting');
    await prisma.event.create({
      data: {
        type: eType, zoneId: allZoneIds[i % allZoneIds.length],
        postId: needsPost ? allPostIds[i % allPostIds.length] : null,
        vehicleSessionId: s[i % 10].id,
        cameraSources: JSON.stringify([`cam${String((i % 10) + 1).padStart(2, '0')}`]),
        confidence: 0.75 + Math.random() * 0.25,
        startTime: m(120 - i * 3),
        rawData: JSON.stringify({ mock: true }),
      },
    });
  }
  console.log('35 events');

  // ======= РЕКОМЕНДАЦИИ (8 шт, RU + EN) =======
  const recs = [
    { type: 'vehicle_idle', postId: p2.id, message: 'Авто В456КМ50 на Посту 2 без работника более 45 минут. Возможен простой.', messageEn: 'Vehicle В456КМ50 at Post 2 without worker for over 45 minutes. Possible idle time.' },
    { type: 'vehicle_idle', postId: p7.id, message: 'Авто К111АА99 на Посту 7 — работник присутствует, но активности нет 40 мин.', messageEn: 'Vehicle К111АА99 at Post 7 — worker present but no activity for 40 min.' },
    { type: 'no_show', message: 'Клиент не приехал: ЗН-2026-0310 (АВ55577), запись была 5 часов назад.', messageEn: 'Client no-show: WO-2026-0310 (АВ55577), appointment was 5 hours ago.' },
    { type: 'capacity_available', zoneId: z6.id, message: 'Посты 6 и 8 свободны, можно принять ещё 2 авто.', messageEn: 'Posts 6 and 8 are free, can accept 2 more vehicles.' },
    { type: 'work_overtime', postId: p1.id, message: 'ТО-2 на Посту 1 (А123ВС77) превышает норму: 2.3ч из 3.0ч запланированных.', messageEn: 'Service TO-2 at Post 1 (А123ВС77) exceeds norm: 2.3h out of 3.0h planned.' },
    { type: 'post_free', postId: p6.id, message: 'Пост 6 свободен более 2 часов при наличии записанных клиентов.', messageEn: 'Post 6 has been free for over 2 hours while there are scheduled clients.' },
    { type: 'post_free', postId: p10.id, message: 'Пост 10 свободен. Есть 2 авто в зоне ожидания.', messageEn: 'Post 10 is free. 2 vehicles in waiting zone.' },
    { type: 'capacity_available', zoneId: z10.id, message: 'Пост 10 свободен, в очереди 1 авто.', messageEn: 'Post 10 is free, 1 vehicle in queue.' },
  ];
  for (const r of recs) await prisma.recommendation.create({ data: r });
  console.log('8 recommendations (RU + EN)');

  console.log('\n✅ Mock data seeded!');
  console.log('  Zones: 10, Posts: 10, Cameras: 10');
  console.log('  Sessions: 14 (10 active, 4 completed)');
  console.log('  Work Orders: 12, Events: 35, Recommendations: 8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
