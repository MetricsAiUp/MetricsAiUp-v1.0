#!/usr/bin/env node
/**
 * Seeds the Prisma/SQLite database with demo data matching the JSON mocks.
 * Run after: npx prisma db seed (which creates zones/posts/cameras/users)
 * Usage: node backend/src/seedDemoDb.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

function uuid(seed) {
  return crypto.createHash('md5').update(String(seed)).digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

const MOSCOW_OFFSET = 3 * 60;
const _now = new Date();
const NOW = new Date(_now.getTime() + (MOSCOW_OFFSET + _now.getTimezoneOffset()) * 60000);
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

function addMin(date, min) { return new Date(date.getTime() + min * 60000); }
function addHours(date, h) { return addMin(date, h * 60); }

let _seed = Math.floor(TODAY.getTime() / 86400000);
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function randBetween(min, max) { return min + seededRandom() * (max - min); }
function roundTo(n, d = 1) { return Math.round(n * (10 ** d)) / (10 ** d); }

const CARS = [
  { brand: 'CITROEN', model: 'JUMPER', plate: 'А001ВС77', vin: 'VF7YDCSFB12X85600' },
  { brand: 'CITROEN', model: 'JUMPER', plate: 'В234КМ50', vin: 'VF7YDCSFC12Y80022' },
  { brand: 'CITROEN', model: 'JUMPY', plate: 'Е567ОР77', vin: 'Z8TVB9HFAMM011957' },
  { brand: 'OPEL', model: 'CROSSLAND', plate: 'О456РС77', vin: 'W0V7H9EDXP4176313' },
  { brand: 'OPEL', model: 'ZAFIRA LIFE', plate: 'С012ХЕ99', vin: 'VXEVEEHZ7PZ037834' },
  { brand: 'PEUGEOT', model: 'BOXER', plate: 'Х901ОН97', vin: 'VF3YDBTFBRMA83988' },
  { brand: 'AVIOR', model: 'V90', plate: 'В567ЕК99', vin: 'LSH14J7C6RA129611' },
  { brand: 'MAXUS', model: 'DELIVER 9', plate: 'К123ОС77', vin: 'LSYABAC58RA012345' },
  { brand: 'DONGFENG', model: 'DFA103W', plate: 'М456НА97', vin: 'Y39JFCTBPR0207092' },
  { brand: 'RENAULT', model: 'DUSTER', plate: 'Р012ВС50', vin: 'X7LHSRH5N66112345' },
  { brand: 'HYUNDAI', model: 'SOLARIS', plate: 'С345ХМ77', vin: 'Z94K241CANR012345' },
  { brand: 'VOLKSWAGEN', model: 'CADDY', plate: 'У901КН99', vin: 'WV2ZZZ2KZKX004037' },
];

const WORK_TYPES = [
  { type: 'ТО-1', normMin: 1.5, normMax: 3 },
  { type: 'ТО-2', normMin: 2.5, normMax: 5 },
  { type: 'Диагностика двигателя', normMin: 0.5, normMax: 1.5 },
  { type: 'Замена масла + фильтры', normMin: 0.5, normMax: 1 },
  { type: 'Замена тормозных колодок', normMin: 1, normMax: 2 },
  { type: 'Шиномонтаж', normMin: 0.5, normMax: 1 },
  { type: 'Замена стоек', normMin: 2, normMax: 3.5 },
  { type: 'Ремонт подвески', normMin: 2, normMax: 4 },
];

async function main() {
  console.log('[SeedDemo] Starting database seed...');

  // Create zones if they don't exist
  const ZONE_DEFS = [
    { name: 'Ремонтная зона (посты 1-4)', type: 'repair', description: 'Нижний ряд, 2-х стоечные подъёмники', postNums: [1,2,3,4] },
    { name: 'Ремонтная зона (посты 5-8)', type: 'repair', description: 'Верхний ряд, 2-х стоечные подъёмники', postNums: [5,6,7,8] },
    { name: 'Диагностика (посты 9-10)', type: 'repair', description: 'Правая часть СТО, диагностические посты', postNums: [9,10] },
    { name: 'Зона Въезд/Выезд', type: 'entry', description: 'Ворота въезда и выезда', postNums: [] },
    { name: 'Зона Ожидания / Парковка', type: 'waiting', description: 'Зона ожидания и парковка готовых авто', postNums: [] },
  ];

  let zones = await prisma.zone.findMany();
  if (zones.length === 0) {
    console.log('[SeedDemo] Creating zones and posts...');
    for (const zd of ZONE_DEFS) {
      const zone = await prisma.zone.create({ data: { name: zd.name, type: zd.type, description: zd.description } });
      for (const pn of zd.postNums) {
        await prisma.post.create({
          data: {
            zoneId: zone.id,
            name: `Пост ${pn}`,
            type: pn <= 4 ? 'heavy' : (pn <= 8 ? 'light' : 'special'),
            status: 'free',
          },
        });
      }
    }
    zones = await prisma.zone.findMany();
  }

  // Create cameras if they don't exist
  const camCount = await prisma.camera.count();
  if (camCount === 0) {
    for (let i = 1; i <= 10; i++) {
      const cam = await prisma.camera.create({
        data: { name: `CAM ${String(i).padStart(2, '0')}`, rtspUrl: `rtsp://cam${i}`, isActive: true },
      });
      // Link camera to first zone
      const zone = zones[Math.min(i - 1, zones.length - 1)];
      if (zone) {
        await prisma.cameraZone.create({ data: { cameraId: cam.id, zoneId: zone.id, priority: 10 - i } });
      }
    }
  }

  const posts = await prisma.post.findMany();

  // Clear old demo data
  await prisma.workOrderLink.deleteMany();
  await prisma.postStay.deleteMany();
  await prisma.zoneStay.deleteMany();
  await prisma.event.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.vehicleSession.deleteMany();
  await prisma.shiftWorker.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.syncLog.deleteMany();
  console.log('[SeedDemo] Cleared old data');

  const shiftStart = new Date(TODAY); shiftStart.setHours(8, 0, 0, 0);
  const usedCars = new Set();

  // Create work orders for each post
  for (const post of posts) {
    const zone = zones.find(z => z.id === post.zoneId) || zones[0];
    let cursor = new Date(shiftStart);
    const woCount = Math.floor(randBetween(3, 5));

    for (let w = 0; w < woCount; w++) {
      let car;
      for (let attempt = 0; attempt < 50; attempt++) {
        car = pick(CARS);
        if (!usedCars.has(car.vin)) break;
      }
      usedCars.add(car.vin);

      const wt = pick(WORK_TYPES);
      const normHours = roundTo(randBetween(wt.normMin, wt.normMax), 1);
      const gapMin = Math.floor(randBetween(5, 25));
      const start = addMin(cursor, gapMin);
      const plannedEnd = addHours(start, normHours);
      cursor = plannedEnd;

      let status, actualEnd, actualHours;
      if (plannedEnd < NOW && start < NOW) {
        actualHours = roundTo(Math.max(0.3, normHours + randBetween(-0.3, 0.4)), 1);
        actualEnd = addHours(start, actualHours);
        status = 'completed';
      } else if (start < NOW && plannedEnd >= NOW) {
        status = 'in_progress';
        actualEnd = null;
        actualHours = null;
      } else {
        status = 'scheduled';
        actualEnd = null;
        actualHours = null;
      }

      const woNum = `КОЛ${String(36200 + posts.indexOf(post) * 10 + w).padStart(8, '0')}`;

      // Create work order
      const workOrder = await prisma.workOrder.create({
        data: {
          externalId: `1C-${woNum}`,
          orderNumber: woNum,
          scheduledTime: start,
          status,
          plateNumber: car.plate,
          workType: wt.type,
          normHours,
          actualHours,
        },
      });

      // Create vehicle session
      const entryTime = addMin(start, -Math.floor(randBetween(5, 15)));
      const session = await prisma.vehicleSession.create({
        data: {
          plateNumber: car.plate,
          entryTime,
          exitTime: status === 'completed' ? addMin(actualEnd, Math.floor(randBetween(5, 15))) : null,
          status: status === 'completed' ? 'completed' : 'active',
          trackId: `track_${car.plate}`,
        },
      });

      // Zone stay
      await prisma.zoneStay.create({
        data: {
          zoneId: zone.id,
          vehicleSessionId: session.id,
          entryTime,
          exitTime: status === 'completed' ? actualEnd : null,
          duration: status === 'completed' ? Math.floor((actualEnd - entryTime) / 1000) : null,
        },
      });

      // Post stay
      const hasWorker = seededRandom() > 0.15;
      const isActive = hasWorker && seededRandom() > 0.2;
      const postStay = await prisma.postStay.create({
        data: {
          postId: post.id,
          vehicleSessionId: session.id,
          startTime: start,
          endTime: actualEnd,
          hasWorker: status !== 'completed' ? hasWorker : true,
          isActive: status === 'in_progress' && isActive,
          activeTime: Math.floor(normHours * 3600 * 0.7),
          idleTime: Math.floor(normHours * 3600 * 0.3),
        },
      });

      // Link WO to session
      await prisma.workOrderLink.create({
        data: {
          vehicleSessionId: session.id,
          postStayId: postStay.id,
          workOrderId: workOrder.id,
          confidence: roundTo(randBetween(0.85, 0.99), 4),
          matchType: 'plate',
        },
      });

      // Update post status for current WO
      if (status === 'in_progress') {
        const postStatus = !hasWorker ? 'occupied_no_work' : (isActive ? 'active_work' : 'occupied');
        await prisma.post.update({ where: { id: post.id }, data: { status: postStatus } });
      }

      // Generate events
      if (status === 'in_progress' || status === 'completed') {
        const cam = await prisma.camera.findFirst();
        const evCount = Math.floor(randBetween(3, 8));
        for (let e = 0; e < evCount; e++) {
          const evTime = addMin(start, Math.floor(randBetween(0, normHours * 60)));
          if (evTime > NOW) continue;
          await prisma.event.create({
            data: {
              type: pick(['work_activity', 'work_idle', 'worker_present', 'post_occupied']),
              zoneId: zone.id,
              postId: post.id,
              vehicleSessionId: session.id,
              cameraId: cam?.id,
              cameraSources: JSON.stringify([`cam${String(posts.indexOf(post) + 1).padStart(2, '0')}`]),
              confidence: roundTo(randBetween(0.8, 0.99), 4),
              startTime: evTime,
            },
          });
        }
      }
    }
  }

  // Free posts
  for (const post of posts) {
    const currentStay = await prisma.postStay.findFirst({
      where: { postId: post.id, endTime: null },
    });
    if (!currentStay) {
      await prisma.post.update({ where: { id: post.id }, data: { status: 'free' } });
    }
  }

  // Recommendations — based on current post states
  const freePosts = posts.filter(async p => {
    const stay = await prisma.postStay.findFirst({ where: { postId: p.id, endTime: null } });
    return !stay;
  });

  // no_show
  await prisma.recommendation.create({
    data: {
      type: 'no_show', zoneId: zones[0]?.id, postId: null,
      message: 'Клиент С345ХМ77 (HYUNDAI SOLARIS) не приехал на ТО-2. Запланировано на 09:30.',
      messageEn: 'Client С345ХМ77 (HYUNDAI SOLARIS) did not arrive for ТО-2. Scheduled at 09:30.',
      status: 'active',
    },
  });
  // post_free
  for (const post of posts.slice(0, 2)) {
    const hasVehicle = await prisma.postStay.findFirst({ where: { postId: post.id, endTime: null } });
    if (!hasVehicle) {
      await prisma.recommendation.create({
        data: {
          type: 'post_free', zoneId: post.zoneId, postId: post.id,
          message: `${post.name} свободен. В очереди есть нераспределённые ЗН.`,
          messageEn: `${post.name} is free. There are unassigned WOs in queue.`,
          status: 'active',
        },
      });
    }
  }
  // capacity_available
  await prisma.recommendation.create({
    data: {
      type: 'capacity_available', zoneId: zones[0]?.id, postId: null,
      message: 'Есть свободная мощность: несколько постов доступны. Можно принять дополнительные заказы.',
      messageEn: 'Capacity available: several posts free. Can accept additional orders.',
      status: 'active',
    },
  });
  // work_overtime
  const overtimeWO = await prisma.workOrder.findFirst({ where: { status: 'in_progress' } });
  if (overtimeWO) {
    const woPost = posts[0];
    await prisma.recommendation.create({
      data: {
        type: 'work_overtime', zoneId: woPost.zoneId, postId: woPost.id,
        message: `Работа на ${woPost.name} затянулась. ЗН ${overtimeWO.orderNumber} (${overtimeWO.workType}, норма ${overtimeWO.normHours}ч).`,
        messageEn: `Work on ${woPost.name} is overdue. WO ${overtimeWO.orderNumber} (${overtimeWO.workType}, norm ${overtimeWO.normHours}h).`,
        status: 'active',
      },
    });
  }
  // vehicle_idle
  await prisma.recommendation.create({
    data: {
      type: 'vehicle_idle', zoneId: zones[0]?.id, postId: posts[2]?.id,
      message: `Авто на ${posts[2]?.name || 'Пост 3'} без активной работы. Работник отсутствует.`,
      messageEn: `Vehicle on ${posts[2]?.name || 'Post 3'} without active work. Worker absent.`,
      status: 'active',
    },
  });

  // Shifts
  const shiftToday = await prisma.shift.create({
    data: {
      name: 'Дневная смена',
      date: TODAY,
      startTime: '08:00',
      endTime: '20:00',
      status: NOW.getHours() >= 8 && NOW.getHours() < 20 ? 'active' : 'planned',
    },
  });

  const workers1C = [
    'Павлович Сергей Леонидович', 'Романовский Денис Сергеевич',
    'Филипеня Павел Григорьевич', 'Кондратенко Андрей Станиславович',
    'Бортник Ярослав Константинович', 'Кендыш Александр Иванович',
    'Швец Алексей Богданович', 'Воропай Александр Антонович',
    'Бобров Александр Владимирович', 'Крылатов Максим Геннадьевич',
  ];
  for (let i = 0; i < workers1C.length; i++) {
    await prisma.shiftWorker.create({
      data: {
        shiftId: shiftToday.id,
        name: workers1C[i],
        role: i < 8 ? 'mechanic' : (i === 8 ? 'master' : 'diagnostician'),
        postId: posts[i]?.id || null,
      },
    });
  }

  // Counts
  const wos = await prisma.workOrder.count();
  const sessions = await prisma.vehicleSession.count();
  const events = await prisma.event.count();
  console.log(`[SeedDemo] Done! WOs: ${wos}, Sessions: ${sessions}, Events: ${events}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
