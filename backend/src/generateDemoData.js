#!/usr/bin/env node
/**
 * Demo Data Generator for MetricsAiUp — Prisma/DB version
 *
 * Generates realistic, time-relative demo data and writes to SQLite via Prisma.
 * All data comes from DB → backend API → frontend. No JSON mocks.
 */

const crypto = require('crypto');
const prisma = require('./config/database');

// ─── Deterministic UUID from seed ───
function uuid(seed) {
  return crypto.createHash('md5').update(String(seed)).digest('hex')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

// ─── Real data from 1C Alfa-Auto ───
const WORKERS = [
  { name: 'Павлович Сергей Леонидович', role: 'mechanic', hours: 224 },
  { name: 'Романовский Денис Сергеевич', role: 'mechanic', hours: 194 },
  { name: 'Филипеня Павел Григорьевич', role: 'mechanic', hours: 183 },
  { name: 'Кондратенко Андрей Станиславович', role: 'mechanic', hours: 165 },
  { name: 'Бортник Ярослав Константинович', role: 'mechanic', hours: 164 },
  { name: 'Кендыш Александр Иванович', role: 'mechanic', hours: 161 },
  { name: 'Швец Алексей Богданович', role: 'mechanic', hours: 160 },
  { name: 'Воропай Александр Антонович', role: 'mechanic', hours: 146 },
  { name: 'Бобров Александр Владимирович', role: 'mechanic', hours: 130 },
  { name: 'Косачук Антон Николаевич', role: 'mechanic', hours: 120 },
  { name: 'Стасевич Дмитрий Сергеевич', role: 'mechanic', hours: 110 },
  { name: 'Гриценко Кирилл Сергеевич', role: 'mechanic', hours: 105 },
];

const MASTERS = [
  'Крылатов Максим Геннадьевич',
  'Эксузьян Андроник Андроникович',
  'Прижилуцкий Юрий Анатольевич',
];

const CARS = [
  { brand: 'CITROEN', model: 'JUMPER', year: '2025', vin: 'VF7YDCSFB12X85600', plate: 'А001ВС77' },
  { brand: 'CITROEN', model: 'JUMPER', year: '2023', vin: 'VF7YDCSFC12Y80022', plate: 'В234КМ50' },
  { brand: 'CITROEN', model: 'JUMPY', year: '2021', vin: 'Z8TVB9HFAMM011957', plate: 'Е567ОР77' },
  { brand: 'CITROEN', model: 'C4 SEDAN', year: '2020', vin: 'Z8TND5GXALM004670', plate: 'К891АС99' },
  { brand: 'CITROEN', model: 'SPACETOURER', year: '2023', vin: 'VF7VEEHZ7PZ069493', plate: 'М123НН50' },
  { brand: 'OPEL', model: 'CROSSLAND', year: '2024', vin: 'W0V7H9EDXP4176313', plate: 'О456РС77' },
  { brand: 'OPEL', model: 'CROSSLAND', year: '2023', vin: 'W0V7H9ED5P4237146', plate: 'Р789ТУ97' },
  { brand: 'OPEL', model: 'ZAFIRA LIFE', year: '2023', vin: 'VXEVEEHZ7PZ037834', plate: 'С012ХЕ99' },
  { brand: 'OPEL', model: 'GRANDLAND X', year: '2020', vin: 'W0VZCYHZ8L6059207', plate: 'Т345ВК77' },
  { brand: 'OPEL', model: 'ZAFIRA LIFE', year: '2025', vin: 'VXEVKEHZXSZ036051', plate: 'У678АМ50' },
  { brand: 'PEUGEOT', model: 'BOXER', year: '2025', vin: 'VF3YDBTFBRMA83988', plate: 'Х901ОН97' },
  { brand: 'PEUGEOT', model: 'PARTNER', year: '2022', vin: 'VF3GCYHZXJS012345', plate: 'А234СТ77' },
  { brand: 'AVIOR', model: 'V90', year: '2024', vin: 'LSH14J7C6RA129611', plate: 'В567ЕК99' },
  { brand: 'AVIOR', model: 'V90', year: '2025', vin: 'LSH14J7C4RA150182', plate: 'Е890МР50' },
  { brand: 'MAXUS', model: 'DELIVER 9', year: '2024', vin: 'LSYABAC58RA012345', plate: 'К123ОС77' },
  { brand: 'DONGFENG', model: 'DFA103W', year: '2024', vin: 'Y39JFCTBPR0207092', plate: 'М456НА97' },
  { brand: 'DONGFENG', model: 'DFA103W', year: '2024', vin: 'Y39JFCTFGR0207090', plate: 'О789ТК99' },
  { brand: 'RENAULT', model: 'DUSTER', year: '2021', vin: 'X7LHSRH5N66112345', plate: 'Р012ВС50' },
  { brand: 'HYUNDAI', model: 'SOLARIS', year: '2022', vin: 'Z94K241CANR012345', plate: 'С345ХМ77' },
  { brand: 'GEELY', model: 'Farizon SuperVan', year: '2024', vin: 'LA71AU939R0604117', plate: 'Т678АР97' },
  { brand: 'VOLKSWAGEN', model: 'CADDY', year: '2018', vin: 'WV2ZZZ2KZKX004037', plate: 'У901КН99' },
  { brand: 'CITROEN', model: 'JUMPER', year: '2024', vin: 'VF7YDBTFCR2Z92771', plate: 'Х234ОЕ50' },
  { brand: 'CITROEN', model: 'JUMPER', year: '2025', vin: 'VF7YDBTFCSMA84460', plate: 'А567ВР77' },
  { brand: 'CITROEN', model: 'JUMPER', year: '2025', vin: 'VF7YDBTFCSMA78834', plate: 'В890КС97' },
];

const REPAIR_TYPES = [
  'Текущий ремонт', 'Техническое обслуживание', 'Предпродажная подготовка',
  'Гарантия ОП', 'Комплектация автомобиля', 'Страховой ремонт',
  'Гарантия СТО', 'Дополнительное оборудование',
];

const WORK_TYPES = [
  { type: 'ТО-1', normMin: 1.5, normMax: 3 },
  { type: 'ТО-2', normMin: 2.5, normMax: 5 },
  { type: 'ТО / ГРМ', normMin: 3, normMax: 6 },
  { type: 'Диагностика двигателя', normMin: 0.5, normMax: 1.5 },
  { type: 'Диагностика ходовой', normMin: 0.5, normMax: 1.5 },
  { type: 'Диагностика АКПП', normMin: 1, normMax: 2 },
  { type: 'Замена масла + фильтры', normMin: 0.5, normMax: 1 },
  { type: 'Замена тормозных колодок', normMin: 1, normMax: 2 },
  { type: 'Замена стоек', normMin: 2, normMax: 3.5 },
  { type: 'Замена ремня ГРМ', normMin: 2.5, normMax: 4 },
  { type: 'Замена сцепления', normMin: 3, normMax: 5 },
  { type: 'Кузовной ремонт', normMin: 3, normMax: 8 },
  { type: 'Шиномонтаж', normMin: 0.5, normMax: 1 },
  { type: 'Компьютерная диагностика', normMin: 0.5, normMax: 1 },
  { type: 'Замена ступичного подшипника', normMin: 1.5, normMax: 3 },
  { type: 'Ремонт подвески', normMin: 2, normMax: 4 },
  { type: 'Замена радиатора', normMin: 1.5, normMax: 3 },
  { type: 'Балансировка колёс', normMin: 0.5, normMax: 1 },
];

// ─── Infrastructure (zones/posts/cameras) ───
// Источник истины — БД (заполняется через MapEditor → mapSyncService).
// Demo-генератор инфраструктуру НЕ создаёт и НЕ удаляет, только читает.
async function loadInfrastructure() {
  const [zonesRaw, postsRaw, camerasRaw] = await Promise.all([
    prisma.zone.findMany({
      where: { deleted: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, description: true },
    }),
    prisma.post.findMany({
      where: { deleted: false, number: { not: null } },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, name: true, type: true, zoneId: true },
    }),
    prisma.camera.findMany({
      where: { deleted: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, rtspUrl: true },
    }),
  ]);

  const ZONES = zonesRaw.map(z => ({ id: z.id, name: z.name, type: z.type, desc: z.description || '' }));
  const POSTS = postsRaw.map(p => ({
    id: p.id,
    number: p.number,
    name: p.name,
    type: p.type,
    zoneId: p.zoneId,
  }));
  const CAMERAS = camerasRaw.map(c => ({ id: c.id, name: c.name, rtspUrl: c.rtspUrl }));

  // Зоны для специальных ролей: entry / waiting (нужны для парковки и въезда).
  const entryZone = ZONES.find(z => z.type === 'entry') || ZONES[0] || null;
  const parkingZone = ZONES.find(z => z.type === 'waiting' || z.type === 'parking') || entryZone;

  return { ZONES, POSTS, CAMERAS, entryZone, parkingZone };
}

// ─── Seeded random ───
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function randBetween(min, max) { return min + seededRandom() * (max - min); }
function roundTo(n, d = 1) { return Math.round(n * (10 ** d)) / (10 ** d); }

// ─── Time helpers (Moscow time) ───
const MOSCOW_OFFSET_MS = 3 * 60 * 60000;
const _now = new Date();
const NOW = new Date(_now.getTime() + (MOSCOW_OFFSET_MS + _now.getTimezoneOffset() * 60000));
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const SHIFT_START_H = 8;
const SHIFT_END_H = 20;
const shiftStart = new Date(TODAY); shiftStart.setHours(SHIFT_START_H, 0, 0, 0);
const shiftEnd = new Date(TODAY); shiftEnd.setHours(SHIFT_END_H, 0, 0, 0);
const totalShiftMinutes = (SHIFT_END_H - SHIFT_START_H) * 60;

function addMin(date, min) { return new Date(date.getTime() + min * 60000); }
function addHours(date, h) { return addMin(date, h * 60); }

// ═════════════════════════════════════════════
// MAIN GENERATE FUNCTION (async — writes to DB)
// ═════════════════════════════════════════════

async function generate() {
  _seed = Math.floor(TODAY.getTime() / 86400000);

  // Инфраструктура — из БД (источник истины: MapEditor → mapSyncService)
  const { ZONES, POSTS, CAMERAS, entryZone, parkingZone } = await loadInfrastructure();
  if (POSTS.length === 0) {
    console.log('[DemoGen] no posts in DB — skipping demo generation');
    return;
  }

  // ─── 1. Generate work orders for today's shift ───
  const usedCars = new Set();
  const allWorkOrders = [];
  const postTimelines = {};

  for (const post of POSTS) {
    const pn = post.number;
    postTimelines[pn] = [];
    let cursor = new Date(shiftStart);
    const woCount = Math.floor(randBetween(3, 6));

    for (let w = 0; w < woCount; w++) {
      if (cursor >= shiftEnd) break;

      let car;
      for (let attempt = 0; attempt < 50; attempt++) {
        car = pick(CARS);
        if (!usedCars.has(car.vin)) break;
      }
      usedCars.add(car.vin);

      const wt = pick(WORK_TYPES);
      const normHours = roundTo(randBetween(wt.normMin, wt.normMax), 1);
      const gapMin = Math.floor(randBetween(5, 20));
      const start = addMin(cursor, gapMin);
      if (start >= shiftEnd) break;
      let plannedEnd = addHours(start, normHours);
      if (plannedEnd > shiftEnd) plannedEnd = new Date(shiftEnd);
      cursor = plannedEnd;

      let status, actualEnd, actualHours;
      if (plannedEnd < NOW && start < NOW) {
        const deviation = randBetween(-0.3, 0.15);
        actualHours = roundTo(Math.max(0.3, normHours + deviation), 1);
        actualEnd = addHours(start, actualHours);
        if (actualEnd > plannedEnd) actualEnd = new Date(plannedEnd);
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

      const woNum = `КОЛ${String(36200 + allWorkOrders.length).padStart(8, '0')}`;
      const worker = WORKERS[(pn - 1) % WORKERS.length];
      const master = MASTERS[pn % MASTERS.length];

      allWorkOrders.push({
        id: uuid(`wo-${pn}-${w}`),
        externalId: `1C-${woNum}`,
        orderNumber: woNum,
        postNumber: pn,
        plateNumber: car.plate,
        brand: car.brand,
        model: car.model,
        workType: wt.type,
        normHours,
        actualHours,
        status,
        scheduledTime: new Date(start),
        startTime: new Date(start),
        endTime: actualEnd,
        estimatedEnd: new Date(plannedEnd),
        worker: worker.name,
        master,
        car,
      });
      postTimelines[pn].push(allWorkOrders[allWorkOrders.length - 1]);
    }
  }

  // Free (unassigned) WOs
  const freeWOs = [];
  for (let i = 0; i < 4; i++) {
    let car;
    for (let attempt = 0; attempt < 50; attempt++) {
      car = pick(CARS);
      if (!usedCars.has(car.vin)) break;
    }
    usedCars.add(car.vin);
    const wt = pick(WORK_TYPES);
    const normHours = roundTo(randBetween(wt.normMin, wt.normMax), 1);
    const schedTime = addMin(shiftStart, Math.floor(randBetween(60, totalShiftMinutes - 60)));
    freeWOs.push({
      id: uuid(`free-wo-${i}`),
      externalId: `1C-КОЛ${String(36300 + i).padStart(8, '0')}`,
      orderNumber: `КОЛ${String(36300 + i).padStart(8, '0')}`,
      plateNumber: car.plate,
      brand: car.brand,
      model: car.model,
      workType: wt.type,
      normHours,
      status: 'scheduled',
      scheduledTime: schedTime,
      startTime: null,
      endTime: null,
      estimatedEnd: addHours(schedTime, normHours),
      postNumber: null,
      worker: null,
      master: null,
      car,
    });
  }

  // No-show WO
  const noShowCar = pick(CARS);
  const noShowScheduled = addMin(shiftStart, 90);
  const noShowWO = {
    id: uuid('no-show-wo'),
    externalId: '1C-КОЛ00036350',
    orderNumber: 'КОЛ00036350',
    plateNumber: noShowCar.plate,
    brand: noShowCar.brand,
    model: noShowCar.model,
    workType: 'ТО-2',
    normHours: 3,
    status: 'no_show',
    scheduledTime: noShowScheduled,
    startTime: null,
    endTime: null,
    estimatedEnd: addHours(noShowScheduled, 3),
    postNumber: null,
    worker: null,
    master: null,
    car: noShowCar,
  };

  const allWOsForDB = [...allWorkOrders, ...freeWOs, noShowWO];

  // ─── 2. Compute post states ───
  const postStates = POSTS.map(post => {
    const timeline = postTimelines[post.number] || [];
    const currentWO = timeline.find(wo => wo.status === 'in_progress');
    const completedWOs = timeline.filter(wo => wo.status === 'completed');
    const scheduledWOs = timeline.filter(wo => wo.status === 'scheduled');

    let status = 'free';
    let currentVehicle = null;
    if (currentWO) {
      const hasWorker = seededRandom() > 0.15;
      const isActive = hasWorker && seededRandom() > 0.2;
      status = !hasWorker ? 'occupied_no_work' : (isActive ? 'active_work' : 'occupied');
      currentVehicle = { plateNumber: currentWO.plateNumber, brand: currentWO.brand, model: currentWO.model };
    }

    return { ...post, status, currentVehicle, currentWO, completedWOs, scheduledWOs, timeline };
  });

  // ─── 3. Generate sessions ───
  const dbSessions = [];
  const dbZoneStays = [];
  const dbPostStays = [];
  const dbWOLinks = [];

  postStates.forEach(ps => {
    if (ps.currentWO) {
      const wo = ps.currentWO;
      const entryTime = addMin(wo.startTime, -Math.floor(randBetween(5, 20)));
      const sessId = uuid(`session-${wo.plateNumber}`);
      dbSessions.push({ id: sessId, plateNumber: wo.plateNumber, entryTime, exitTime: null, status: 'active', trackId: `track_${wo.plateNumber}` });
      dbZoneStays.push({ id: uuid(`zs-${wo.id}`), zoneId: ps.zoneId, vehicleSessionId: sessId, entryTime, exitTime: null, duration: null });
      const psId = uuid(`ps-${wo.id}`);
      dbPostStays.push({ id: psId, postId: ps.id, vehicleSessionId: sessId, startTime: wo.startTime, endTime: null, hasWorker: ps.status !== 'occupied_no_work', isActive: ps.status === 'active_work', activeTime: Math.floor((NOW - wo.startTime) / 1000 * 0.7), idleTime: Math.floor((NOW - wo.startTime) / 1000 * 0.3) });
      dbWOLinks.push({ id: uuid(`link-${wo.id}`), vehicleSessionId: sessId, postStayId: psId, workOrderId: wo.id, confidence: roundTo(randBetween(0.85, 0.99), 4), matchType: 'plate' });
    }
    ps.completedWOs.forEach(wo => {
      const entryTime = addMin(wo.startTime, -Math.floor(randBetween(5, 20)));
      const exitTime = addMin(wo.endTime, Math.floor(randBetween(5, 15)));
      const sessId = uuid(`session-c-${wo.id}`);
      dbSessions.push({ id: sessId, plateNumber: wo.plateNumber, entryTime, exitTime, status: 'completed', trackId: `track_${wo.plateNumber}` });
      dbZoneStays.push({ id: uuid(`zs-c-${wo.id}`), zoneId: ps.zoneId, vehicleSessionId: sessId, entryTime, exitTime, duration: Math.floor((exitTime - entryTime) / 1000) });
      const psId = uuid(`ps-c-${wo.id}`);
      dbPostStays.push({ id: psId, postId: ps.id, vehicleSessionId: sessId, startTime: wo.startTime, endTime: wo.endTime, hasWorker: true, isActive: false, activeTime: Math.floor(wo.normHours * 3600 * 0.75), idleTime: Math.floor(wo.normHours * 3600 * 0.25) });
      dbWOLinks.push({ id: uuid(`link-c-${wo.id}`), vehicleSessionId: sessId, postStayId: psId, workOrderId: wo.id, confidence: roundTo(randBetween(0.85, 0.99), 4), matchType: 'plate' });
    });
  });

  // Parking vehicles
  if (parkingZone) {
    for (let i = 0; i < 2; i++) {
      const car = CARS[CARS.length - 1 - i];
      const entryTime = addMin(NOW, -Math.floor(randBetween(10, 40)));
      const sessId = uuid(`parking-session-${i}`);
      dbSessions.push({ id: sessId, plateNumber: car.plate, entryTime, exitTime: null, status: 'active', trackId: `track_park_${i}` });
      dbZoneStays.push({ id: uuid(`zs-park-${i}`), zoneId: parkingZone.id, vehicleSessionId: sessId, entryTime, exitTime: null, duration: null });
    }
  }

  // ─── 4. Generate events ───
  const dbEvents = [];
  const eventStart = addMin(NOW, -120);

  postStates.filter(p => p.status !== 'free').forEach((ps, idx) => {
    const cam = CAMERAS[idx % CAMERAS.length] || CAMERAS[0];
    if (!cam) return;
    let t = new Date(eventStart);
    while (t < NOW) {
      const isWork = seededRandom() > 0.3;
      dbEvents.push({
        id: uuid(`ev-${ps.number}-${t.getTime()}`),
        type: isWork ? 'work_activity' : 'work_idle',
        zoneId: ps.zoneId,
        postId: ps.id,
        vehicleSessionId: ps.currentWO ? uuid(`session-${ps.currentWO.plateNumber}`) : null,
        cameraId: cam.id,
        cameraSources: JSON.stringify([cam.name.toLowerCase().replace(' ', '')]),
        confidence: roundTo(randBetween(0.78, 0.99), 4),
        startTime: new Date(t),
        endTime: null,
        rawData: JSON.stringify({ source: 'cv_engine_v2' }),
      });
      t = addMin(t, Math.floor(randBetween(2, 8)));
    }
  });

  // Entry events
  if (entryZone && CAMERAS.length > 0) {
    dbSessions.filter(s => s.status === 'active').forEach((sess, i) => {
      dbEvents.push({
        id: uuid(`ev-entry-${i}`),
        type: 'vehicle_entered_zone',
        zoneId: entryZone.id,
        postId: null,
        vehicleSessionId: sess.id,
        cameraId: CAMERAS[0].id,
        cameraSources: JSON.stringify([CAMERAS[0].name.toLowerCase().replace(' ', '')]),
        confidence: roundTo(randBetween(0.88, 0.99), 4),
        startTime: sess.entryTime,
        endTime: null,
        rawData: JSON.stringify({ plateNumber: sess.plateNumber, source: 'cv_engine_v2' }),
      });
    });
  }

  // Limit events to 200 most recent
  dbEvents.sort((a, b) => b.startTime - a.startTime);
  const eventsToInsert = dbEvents.slice(0, 200);

  // ─── 5. Generate recommendations ───
  const dbRecs = [];
  const freePosts = postStates.filter(p => p.status === 'free');

  // No-show
  dbRecs.push({
    id: uuid('rec-noshow'),
    type: 'no_show',
    zoneId: null, postId: null,
    message: `Клиент ${noShowWO.plateNumber} (${noShowWO.brand} ${noShowWO.model}) не приехал на ${noShowWO.workType}. ЗН ${noShowWO.orderNumber}`,
    messageEn: `Client ${noShowWO.plateNumber} (${noShowWO.brand} ${noShowWO.model}) did not arrive for ${noShowWO.workType}. WO ${noShowWO.orderNumber}`,
    status: 'active',
  });

  // Free posts
  freePosts.forEach(p => {
    dbRecs.push({
      id: uuid(`rec-free-${p.number}`),
      type: 'post_free',
      zoneId: p.zoneId, postId: p.id,
      message: `${p.name} свободен. В очереди ${freeWOs.length} нераспределённых ЗН.`,
      messageEn: `${p.name} is free. ${freeWOs.length} unassigned WOs in queue.`,
      status: 'active',
    });
  });

  // Capacity available
  if (freePosts.length >= 2 && ZONES.length > 0) {
    dbRecs.push({
      id: uuid('rec-capacity'),
      type: 'capacity_available',
      zoneId: ZONES[0].id, postId: null,
      message: `Есть свободная мощность: ${freePosts.length} постов доступны. Можно принять дополнительные заказы.`,
      messageEn: `Capacity available: ${freePosts.length} posts free. Can accept additional orders.`,
      status: 'active',
    });
  }

  // Overtime
  allWorkOrders.filter(wo => wo.status === 'in_progress').forEach(wo => {
    const est = wo.estimatedEnd;
    if (est < NOW) {
      const post = POSTS.find(p => p.number === wo.postNumber);
      const overMin = Math.round((NOW - est) / 60000);
      dbRecs.push({
        id: uuid(`rec-overtime-${wo.id}`),
        type: 'work_overtime',
        zoneId: post?.zoneId || null, postId: post?.id || null,
        message: `Работа на ${post?.name} затянулась на ${overMin} мин. ЗН ${wo.orderNumber} (${wo.workType}, норма ${wo.normHours}ч).`,
        messageEn: `Work on ${post?.name} is ${overMin} min overdue. WO ${wo.orderNumber} (${wo.workType}, norm ${wo.normHours}h).`,
        status: 'active',
      });
    }
  });

  // Idle vehicle
  postStates.filter(p => p.status === 'occupied_no_work').forEach(p => {
    dbRecs.push({
      id: uuid(`rec-idle-${p.number}`),
      type: 'vehicle_idle',
      zoneId: p.zoneId, postId: p.id,
      message: `Авто ${p.currentVehicle?.plateNumber} на ${p.name} без активной работы. Работник отсутствует.`,
      messageEn: `Vehicle ${p.currentVehicle?.plateNumber} on ${p.name} without active work. Worker absent.`,
      status: 'active',
    });
  });

  // ─── 6. Generate shifts ───
  const dbShifts = [];
  const dbShiftWorkers = [];
  const todayStr = TODAY.toISOString().split('T')[0];

  for (let d = -7; d <= 6; d++) {
    const day = new Date(TODAY);
    day.setDate(day.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];
    const dow = day.getDay();
    if (dow === 0) continue;
    if (dow === 6 && d < 0) continue;
    const isSaturday = dow === 6;
    const isToday = dateStr === todayStr;
    const isPast = day < TODAY;

    let status;
    if (isPast) status = 'completed';
    else if (isToday) status = (NOW >= shiftStart && NOW <= shiftEnd) ? 'active' : 'planned';
    else status = 'planned';

    const shiftId = uuid(`shift-${dateStr}`);
    const workerOffset = (d + 7) % WORKERS.length;
    const workerCount = isSaturday ? 5 : (8 + Math.abs(d) % 3);

    const notes = isPast ? pick([
      'Смена завершена штатно.',
      'Все ЗН выполнены в срок.',
      'Без происшествий.',
    ]) : null;

    dbShifts.push({
      id: shiftId,
      name: isSaturday ? 'Дежурная смена' : 'Дневная смена',
      date: new Date(dateStr + 'T00:00:00'),
      startTime: isSaturday ? '09:00' : '08:00',
      endTime: isSaturday ? '16:00' : '20:00',
      status,
      notes,
    });

    for (let wi = 0; wi < Math.min(workerCount, WORKERS.length); wi++) {
      const w = WORKERS[(workerOffset + wi) % WORKERS.length];
      dbShiftWorkers.push({
        id: uuid(`sw-${dateStr}-${wi}`),
        shiftId,
        name: w.name,
        role: wi < workerCount - 2 ? 'mechanic' : (wi === workerCount - 2 ? 'master' : 'diagnostician'),
        postId: wi < 10 ? POSTS[wi]?.id : null,
      });
    }
  }

  // ═════════════════════════════════════════════
  // WRITE TO DATABASE
  // ═════════════════════════════════════════════

  // Phase 1: Delete only demo-generated data (order matters for foreign keys).
  // Инфраструктуру (zones/posts/cameras/cameraZone) НЕ трогаем — это домен MapEditor → mapSyncService.
  await prisma.event.deleteMany({});
  await prisma.workOrderLink.deleteMany({});
  await prisma.postStay.deleteMany({});
  await prisma.zoneStay.deleteMany({});
  await prisma.vehicleSession.deleteMany({});
  await prisma.recommendation.deleteMany({});
  await prisma.shiftWorker.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.workOrder.deleteMany({});

  // Phase 2: Sync post statuses (только status, без upsert id/name/type).
  for (const p of POSTS) {
    const ps = postStates.find(s => s.number === p.number);
    await prisma.post.update({
      where: { id: p.id },
      data: { status: ps?.status || 'free' },
    }).catch(() => {}); // best-effort
  }

  // Phase 3: Create demo data
  await prisma.workOrder.createMany({
    data: allWOsForDB.map(wo => ({
      id: wo.id,
      externalId: wo.externalId,
      orderNumber: wo.orderNumber,
      scheduledTime: wo.scheduledTime,
      status: wo.status,
      plateNumber: wo.plateNumber,
      workType: wo.workType,
      normHours: wo.normHours,
      actualHours: wo.actualHours,
      brand: wo.brand,
      model: wo.model,
      worker: wo.worker,
      master: wo.master,
      postNumber: wo.postNumber,
      startTime: wo.startTime,
      endTime: wo.endTime,
      estimatedEnd: wo.estimatedEnd,
    })),
  });

  const uniqueSessions = [...new Map(dbSessions.map(s => [s.id, s])).values()];
  await prisma.vehicleSession.createMany({
    data: uniqueSessions.map(s => ({
      id: s.id,
      plateNumber: s.plateNumber,
      entryTime: s.entryTime,
      exitTime: s.exitTime,
      status: s.status,
      trackId: s.trackId,
    })),
  });

  await prisma.zoneStay.createMany({
    data: dbZoneStays.map(zs => ({
      id: zs.id,
      zoneId: zs.zoneId,
      vehicleSessionId: zs.vehicleSessionId,
      entryTime: zs.entryTime,
      exitTime: zs.exitTime,
      duration: zs.duration,
    })),
  });

  await prisma.postStay.createMany({
    data: dbPostStays.map(ps => ({
      id: ps.id,
      postId: ps.postId,
      vehicleSessionId: ps.vehicleSessionId,
      startTime: ps.startTime,
      endTime: ps.endTime,
      hasWorker: ps.hasWorker,
      isActive: ps.isActive,
      activeTime: ps.activeTime,
      idleTime: ps.idleTime,
    })),
  });

  await prisma.workOrderLink.createMany({
    data: dbWOLinks.map(l => ({
      id: l.id,
      vehicleSessionId: l.vehicleSessionId,
      postStayId: l.postStayId,
      workOrderId: l.workOrderId,
      confidence: l.confidence,
      matchType: l.matchType,
    })),
  });

  // Events — insert in batches to avoid SQLite limits
  for (let i = 0; i < eventsToInsert.length; i += 50) {
    const batch = eventsToInsert.slice(i, i + 50);
    await prisma.event.createMany({
      data: batch.map(ev => ({
        id: ev.id,
        type: ev.type,
        zoneId: ev.zoneId,
        postId: ev.postId,
        vehicleSessionId: ev.vehicleSessionId,
        cameraId: ev.cameraId,
        cameraSources: ev.cameraSources,
        confidence: ev.confidence,
        startTime: ev.startTime,
        endTime: ev.endTime,
        rawData: ev.rawData,
      })),
    });
  }

  await prisma.recommendation.createMany({
    data: dbRecs.map(r => ({
      id: r.id,
      type: r.type,
      zoneId: r.zoneId,
      postId: r.postId,
      message: r.message,
      messageEn: r.messageEn,
      status: r.status,
    })),
  });

  await prisma.shift.createMany({
    data: dbShifts.map(s => ({
      id: s.id,
      name: s.name,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      notes: s.notes,
    })),
  });

  await prisma.shiftWorker.createMany({
    data: dbShiftWorkers.map(sw => ({
      id: sw.id,
      shiftId: sw.shiftId,
      name: sw.name,
      role: sw.role,
      postId: sw.postId,
    })),
  });

  // Summary
  const occupiedPosts = postStates.filter(p => p.status !== 'free');
  console.log(`[DemoGen] DB updated at ${NOW.toLocaleTimeString()}`);
  console.log(`  WOs: ${allWOsForDB.length} (completed: ${allWorkOrders.filter(w=>w.status==='completed').length}, in_progress: ${allWorkOrders.filter(w=>w.status==='in_progress').length}, scheduled: ${allWorkOrders.filter(w=>w.status==='scheduled').length})`);
  console.log(`  Sessions: ${dbSessions.filter(s=>s.status==='active').length} active, ${dbSessions.filter(s=>s.status==='completed').length} completed`);
  console.log(`  Events: ${eventsToInsert.length}, Recommendations: ${dbRecs.length}`);
  console.log(`  Posts: ${occupiedPosts.length} occupied, ${freePosts.length} free`);
  console.log(`  Shifts: ${dbShifts.length}`);
}

module.exports = { generate, WORKERS, MASTERS, WORK_TYPES };
