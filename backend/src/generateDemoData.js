#!/usr/bin/env node
/**
 * Demo Data Generator for MetricsAiUp
 *
 * Generates realistic, time-relative demo data based on real 1C Alfa-Auto data.
 * Run: node backend/src/generateDemoData.js
 * Auto-refresh: called from backend on interval
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');

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

// ─── Zone/Post definitions (matching existing IDs) ───
const ZONES = [
  { id: uuid('zone-repair-1-4'), name: 'Ремонтная зона (посты 1-4)', type: 'repair', desc: 'Нижний ряд, 2-х стоечные подъёмники', posts: [1,2,3,4] },
  { id: uuid('zone-repair-5-8'), name: 'Ремонтная зона (посты 5-8)', type: 'repair', desc: 'Верхний ряд, 2-х стоечные подъёмники', posts: [5,6,7,8] },
  { id: uuid('zone-diag-9-10'), name: 'Диагностика (посты 9-10)', type: 'repair', desc: 'Правая часть СТО, диагностические посты', posts: [9,10] },
  { id: uuid('zone-entry'), name: 'Зона Въезд/Выезд', type: 'entry', desc: 'Ворота въезда и выезда', posts: [] },
  { id: uuid('zone-parking'), name: 'Зона Ожидания / Парковка', type: 'waiting', desc: 'Зона ожидания и парковка готовых авто', posts: [] },
];

const POSTS = [];
for (let i = 1; i <= 10; i++) {
  const zone = ZONES.find(z => z.posts.includes(i));
  POSTS.push({
    id: uuid(`post-${i}`),
    number: i,
    name: `Пост ${i}`,
    type: i <= 4 ? 'heavy' : (i <= 8 ? 'light' : 'special'),
    zoneId: zone?.id,
    zoneName: zone?.name,
    zoneType: zone?.type,
  });
}

const CAMERAS = Array.from({ length: 10 }, (_, i) => ({
  id: uuid(`cam-${i + 1}`),
  name: `CAM ${String(i + 1).padStart(2, '0')}`,
  rtspUrl: `rtsp://cam${i + 1}`,
}));

// ─── Seeded random ───
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function pick(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, n);
}
function randBetween(min, max) { return min + seededRandom() * (max - min); }
function roundTo(n, d = 1) { return Math.round(n * (10 ** d)) / (10 ** d); }

// ─── Time helpers ───
// Use local-style ISO strings (no Z suffix) so browser interprets them in user's timezone.
// The shift bounds in DashboardPosts use `new Date("YYYY-MM-DDT08:00:00")` (local),
// so our block times must also be local (no Z).
const MOSCOW_OFFSET_MS = 3 * 60 * 60000;
const _now = new Date();
// Calculate "Moscow now" for status determination (completed/in_progress/scheduled)
const NOW = new Date(_now.getTime() + (MOSCOW_OFFSET_MS + _now.getTimezoneOffset() * 60000));
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const SHIFT_START_H = 8;
const SHIFT_END_H = 20;
const shiftStart = new Date(TODAY); shiftStart.setHours(SHIFT_START_H, 0, 0, 0);
const shiftEnd = new Date(TODAY); shiftEnd.setHours(SHIFT_END_H, 0, 0, 0);
const currentMinuteOfShift = Math.max(0, (NOW - shiftStart) / 60000);
const totalShiftMinutes = (SHIFT_END_H - SHIFT_START_H) * 60;

// Output as local ISO string WITHOUT Z suffix so browser treats it as local time
function timeStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}
function addMin(date, min) { return new Date(date.getTime() + min * 60000); }
function addHours(date, h) { return addMin(date, h * 60); }

// ═════════════════════════════════════════════
// GENERATE MAIN DATA
// ═════════════════════════════════════════════

function generate() {
  _seed = Math.floor(TODAY.getTime() / 86400000); // same seed per day, different each day

  // ─── 1. Generate work orders for today's shift ───
  const usedCars = new Set();
  const allWorkOrders = [];
  const postTimelines = {}; // postNumber -> [{wo}]

  for (let pn = 1; pn <= 10; pn++) {
    postTimelines[pn] = [];
    let cursor = new Date(shiftStart);
    // Each post gets 3-5 WOs per day
    const woCount = Math.floor(randBetween(3, 6));

    for (let w = 0; w < woCount; w++) {
      // Stop if we'd exceed the shift
      if (cursor >= shiftEnd) break;

      // Pick a car not already used today
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
      // Don't start past shift end
      if (start >= shiftEnd) break;
      // Cap planned end to shift end
      let plannedEnd = addHours(start, normHours);
      if (plannedEnd > shiftEnd) plannedEnd = new Date(shiftEnd);
      cursor = plannedEnd;

      // Determine status based on current time
      let status, actualEnd, actualHours;
      if (plannedEnd < NOW && start < NOW) {
        // Completed — finished in the past
        const deviation = randBetween(-0.3, 0.4);
        actualHours = roundTo(Math.max(0.3, normHours + deviation), 1);
        actualEnd = addHours(start, actualHours);
        status = 'completed';
      } else if (start < NOW && plannedEnd >= NOW) {
        // In progress right now
        status = 'in_progress';
        actualEnd = null;
        actualHours = null;
      } else {
        // Scheduled for later
        status = 'scheduled';
        actualEnd = null;
        actualHours = null;
      }

      const woNum = `КОЛ${String(36200 + allWorkOrders.length).padStart(8, '0')}`;
      const worker = WORKERS[(pn - 1) % WORKERS.length];
      const master = MASTERS[pn % MASTERS.length];

      const wo = {
        id: uuid(`wo-${pn}-${w}`),
        externalId: `1C-${woNum}`,
        orderNumber: woNum,
        postNumber: pn,
        plateNumber: car.plate,
        brand: car.brand,
        model: car.model,
        vin: car.vin,
        workType: wt.type,
        repairType: pick(REPAIR_TYPES),
        normHours,
        actualHours,
        status,
        scheduledTime: timeStr(start),
        startTime: timeStr(start),
        endTime: actualEnd ? timeStr(actualEnd) : null,
        estimatedEnd: timeStr(plannedEnd),
        worker: worker.name,
        master,
        car,
      };

      allWorkOrders.push(wo);
      postTimelines[pn].push(wo);
    }
  }

  // Add 3-4 free (unassigned) WOs
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
      scheduledTime: timeStr(addMin(shiftStart, Math.floor(randBetween(60, totalShiftMinutes - 60)))),
    });
  }

  // Add 1 no-show
  const noShowCar = pick(CARS);
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
    scheduledTime: timeStr(addMin(shiftStart, 90)),
  };

  // ─── Current state: which posts are occupied NOW ───
  const postStates = POSTS.map(post => {
    const timeline = postTimelines[post.number] || [];
    const currentWO = timeline.find(wo => wo.status === 'in_progress');
    const completedWOs = timeline.filter(wo => wo.status === 'completed');
    const scheduledWOs = timeline.filter(wo => wo.status === 'scheduled');

    let status = 'free';
    let currentVehicle = null;
    if (currentWO) {
      const hasWorker = seededRandom() > 0.15; // 85% worker present
      const isActive = hasWorker && seededRandom() > 0.2; // 80% of worker-present is active
      status = !hasWorker ? 'occupied_no_work' : (isActive ? 'active_work' : 'occupied');
      currentVehicle = {
        plateNumber: currentWO.plateNumber,
        brand: currentWO.brand,
        model: currentWO.model,
        color: pick(['белый', 'серый', 'чёрный', 'синий', 'красный', 'серебристый']),
      };
    }

    return { ...post, status, currentVehicle, currentWO, completedWOs, scheduledWOs, timeline };
  });

  // ─── 2. dashboard-posts.json ───
  const dashboardPosts = {
    settings: { shiftStart: '08:00', shiftEnd: '20:00', postsCount: 10, mode: 'demo' },
    posts: postStates.map(ps => ({
      id: `post-${ps.number}`,
      number: ps.number,
      name: ps.name,
      type: ps.type,
      zone: ps.zoneName,
      status: ps.status,
      currentVehicle: ps.currentVehicle,
      timeline: ps.timeline.map(wo => ({
        id: `tl-${ps.number}-${wo.orderNumber}`,
        workOrderNumber: wo.orderNumber,
        workOrderId: wo.id,
        plateNumber: wo.plateNumber,
        brand: wo.brand,
        model: wo.model,
        workType: wo.workType,
        status: wo.status,
        startTime: wo.startTime,
        endTime: wo.endTime,
        normHours: wo.normHours,
        master: wo.master,
        worker: wo.worker,
        actualHours: wo.actualHours,
        estimatedEnd: wo.estimatedEnd,
      })),
      freeWorkOrders: ps.number === 1 ? freeWOs.map(f => ({
        id: f.id, orderNumber: f.orderNumber, plateNumber: f.plateNumber,
        brand: f.brand, model: f.model, workType: f.workType,
        normHours: f.normHours, status: f.status,
      })) : undefined,
    })),
  };

  // ─── 3. work-orders.json ───
  const allWOsForExport = [...allWorkOrders, ...freeWOs, noShowWO];
  const workOrdersJson = {
    orders: allWOsForExport.map(wo => ({
      id: wo.id,
      externalId: wo.externalId,
      orderNumber: wo.orderNumber,
      scheduledTime: wo.scheduledTime,
      status: wo.status,
      plateNumber: wo.plateNumber,
      workType: wo.workType,
      normHours: wo.normHours,
      actualHours: wo.actualHours || null,
      createdAt: timeStr(addHours(shiftStart, -12)),
      updatedAt: timeStr(NOW),
      links: wo.status === 'in_progress' || wo.status === 'completed' ? [{
        id: uuid(`link-${wo.id}`),
        vehicleSessionId: uuid(`session-${wo.plateNumber}`),
        postStayId: null,
        workOrderId: wo.id,
        confidence: roundTo(randBetween(0.85, 0.99), 4),
        matchType: 'plate',
        vehicleSession: {
          id: uuid(`session-${wo.plateNumber}`),
          plateNumber: wo.plateNumber,
          entryTime: wo.scheduledTime,
          exitTime: wo.status === 'completed' ? wo.endTime : null,
          status: wo.status === 'completed' ? 'completed' : 'active',
          trackId: `track_${wo.plateNumber}`,
          createdAt: wo.scheduledTime,
          updatedAt: timeStr(NOW),
        },
      }] : [],
    })),
    total: allWOsForExport.length,
  };

  // ─── 4. sessions.json (active) ───
  const activeSessions = [];
  const completedSessions = [];

  postStates.forEach(ps => {
    // Active session for in_progress WO
    if (ps.currentWO) {
      const wo = ps.currentWO;
      const entryTime = addMin(new Date(wo.startTime), -Math.floor(randBetween(5, 20)));
      activeSessions.push(makeSession(wo, ps, entryTime, null, 'active'));
    }
    // Completed sessions
    ps.completedWOs.forEach(wo => {
      const entryTime = addMin(new Date(wo.startTime), -Math.floor(randBetween(5, 20)));
      const exitTime = addMin(new Date(wo.endTime), Math.floor(randBetween(5, 15)));
      completedSessions.push(makeSession(wo, ps, entryTime, exitTime, 'completed'));
    });
  });

  // 2 vehicles in parking/waiting
  for (let i = 0; i < 2; i++) {
    const car = CARS[CARS.length - 1 - i];
    const entryTime = addMin(NOW, -Math.floor(randBetween(10, 40)));
    activeSessions.push({
      id: uuid(`parking-session-${i}`),
      plateNumber: car.plate,
      entryTime: timeStr(entryTime),
      exitTime: null,
      status: 'active',
      trackId: `track_park_${i}`,
      createdAt: timeStr(entryTime),
      updatedAt: timeStr(NOW),
      zoneStays: [{
        id: uuid(`zs-park-${i}`),
        zoneId: ZONES[4].id, // parking
        vehicleSessionId: uuid(`parking-session-${i}`),
        entryTime: timeStr(entryTime),
        exitTime: null,
        duration: null,
        zone: { id: ZONES[4].id, name: ZONES[4].name, type: ZONES[4].type, description: ZONES[4].desc, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
      }],
      postStays: [],
    });
  }

  const sessionsJson = { sessions: activeSessions, total: activeSessions.length };
  const sessionsCompletedJson = { sessions: completedSessions.slice(-10), total: completedSessions.length };

  // ─── 5. events.json ───
  const events = generateEvents(postStates, activeSessions);

  // ─── 6. dashboard-overview.json ───
  const occupiedPosts = postStates.filter(p => p.status !== 'free');
  const freePosts = postStates.filter(p => p.status === 'free');
  const activeWorkPosts = postStates.filter(p => p.status === 'active_work');

  const dashboardOverview = {
    activeSessions: activeSessions.length,
    zonesWithVehicles: ZONES.filter(z => z.type !== 'entry').map(z => {
      const postsInZone = postStates.filter(p => p.zoneId === z.id);
      const vehicleCount = postsInZone.filter(p => p.status !== 'free').length + (z.type === 'waiting' ? 2 : 0);
      return { zoneId: z.id, zoneName: z.name, zoneType: z.type, vehicleCount };
    }).filter(z => z.vehicleCount > 0),
    postsStatus: postStates.map(p => ({
      postId: p.id, postName: p.name, status: p.status,
      plateNumber: p.currentVehicle?.plateNumber || null,
      workerPresent: p.status === 'active_work' || p.status === 'occupied',
    })),
    activeRecommendations: 0, // will be set after recommendations
    completedToday: allWorkOrders.filter(w => w.status === 'completed').length,
    totalNormHours: roundTo(allWorkOrders.reduce((s, w) => s + w.normHours, 0), 1),
    freePostsCount: freePosts.length,
    occupiedPostsCount: occupiedPosts.length,
    activeWorkCount: activeWorkPosts.length,
  };

  // ─── 7. recommendations.json ───
  const recommendations = [];
  // No-show recommendation
  recommendations.push({
    id: uuid('rec-noshow'),
    type: 'no_show',
    zoneId: null, postId: null,
    message: `Клиент ${noShowWO.plateNumber} (${noShowWO.brand} ${noShowWO.model}) не приехал на ${noShowWO.workType}. ЗН ${noShowWO.orderNumber}`,
    messageEn: `Client ${noShowWO.plateNumber} (${noShowWO.brand} ${noShowWO.model}) did not arrive for ${noShowWO.workType}. WO ${noShowWO.orderNumber}`,
    status: 'active',
    createdAt: timeStr(addMin(new Date(noShowWO.scheduledTime), 30)),
    updatedAt: timeStr(NOW),
  });
  // Free post recommendations
  freePosts.forEach(p => {
    recommendations.push({
      id: uuid(`rec-free-${p.number}`),
      type: 'post_free',
      zoneId: p.zoneId, postId: p.id,
      message: `${p.name} свободен. В очереди ${freeWOs.length} нераспределённых ЗН.`,
      messageEn: `${p.name} is free. ${freeWOs.length} unassigned WOs in queue.`,
      status: 'active',
      zone: { id: p.zoneId, name: p.zoneName },
      post: { id: p.id, name: p.name },
      createdAt: timeStr(addMin(NOW, -15)),
      updatedAt: timeStr(NOW),
    });
  });
  // Capacity available
  if (freePosts.length >= 2) {
    recommendations.push({
      id: uuid('rec-capacity'),
      type: 'capacity_available',
      zoneId: ZONES[0].id, postId: null,
      message: `Есть свободная мощность: ${freePosts.length} постов доступны. Можно принять дополнительные заказы.`,
      messageEn: `Capacity available: ${freePosts.length} posts free. Can accept additional orders.`,
      status: 'active',
      zone: { id: ZONES[0].id, name: ZONES[0].name },
      createdAt: timeStr(addMin(NOW, -10)),
      updatedAt: timeStr(NOW),
    });
  }
  // Overtime on some in_progress WOs
  allWorkOrders.filter(wo => wo.status === 'in_progress').forEach(wo => {
    const est = new Date(wo.estimatedEnd);
    if (est < NOW) {
      const post = POSTS.find(p => p.number === wo.postNumber);
      const overMin = Math.round((NOW - est) / 60000);
      recommendations.push({
        id: uuid(`rec-overtime-${wo.id}`),
        type: 'work_overtime',
        zoneId: post?.zoneId, postId: post?.id,
        message: `Работа на ${post?.name} затянулась на ${overMin} мин. ЗН ${wo.orderNumber} (${wo.workType}, норма ${wo.normHours}ч).`,
        messageEn: `Work on ${post?.name} is ${overMin} min overdue. WO ${wo.orderNumber} (${wo.workType}, norm ${wo.normHours}h).`,
        status: 'active',
        zone: post ? { id: post.zoneId, name: post.zoneName } : undefined,
        post: post ? { id: post.id, name: post.name } : undefined,
        createdAt: timeStr(est),
        updatedAt: timeStr(NOW),
      });
    }
  });
  // Idle vehicle
  postStates.filter(p => p.status === 'occupied_no_work').forEach(p => {
    recommendations.push({
      id: uuid(`rec-idle-${p.number}`),
      type: 'vehicle_idle',
      zoneId: p.zoneId, postId: p.id,
      message: `Авто ${p.currentVehicle?.plateNumber} на ${p.name} без активной работы. Работник отсутствует.`,
      messageEn: `Vehicle ${p.currentVehicle?.plateNumber} on ${p.name} without active work. Worker absent.`,
      status: 'active',
      zone: { id: p.zoneId, name: p.zoneName },
      post: { id: p.id, name: p.name },
      createdAt: timeStr(addMin(NOW, -8)),
      updatedAt: timeStr(NOW),
    });
  });

  dashboardOverview.activeRecommendations = recommendations.length;

  // ─── 8. shifts.json ───
  const shiftsJson = generateShifts(postStates);

  // ─── 9. posts-analytics.json ───
  const postsAnalytics = generatePostsAnalytics(postStates, allWorkOrders);

  // ─── 10. analytics-history.json ───
  const analyticsHistory = generateAnalyticsHistory();

  // ─── 11. dashboard-metrics ───
  const metrics30d = generateMetrics(30);
  const metrics7d = generateMetrics(7);
  const metrics24h = generateMetrics(1);

  // ─── 12. posts.json (zone-post structure) ───
  const postsJson = POSTS.map(p => {
    const ps = postStates.find(s => s.number === p.number);
    return {
      id: p.id, zoneId: p.zoneId, name: p.name, type: p.type, status: ps.status,
      coordinates: null, isActive: true,
      createdAt: timeStr(TODAY), updatedAt: timeStr(NOW),
      stays: ps.currentWO ? [{
        id: uuid(`stay-${p.number}`),
        postId: p.id, vehicleSessionId: uuid(`session-${ps.currentWO.plateNumber}`),
        startTime: ps.currentWO.startTime,
        endTime: null, hasWorker: ps.status !== 'occupied_no_work',
        isActive: ps.status === 'active_work',
        activeTime: Math.floor((NOW - new Date(ps.currentWO.startTime)) / 1000 * 0.7),
        idleTime: Math.floor((NOW - new Date(ps.currentWO.startTime)) / 1000 * 0.3),
      }] : [],
      zone: { id: p.zoneId, name: p.zoneName, type: p.zoneType, description: ZONES.find(z => z.id === p.zoneId)?.desc, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
    };
  });

  // ─── 13. zones.json ───
  const zonesJson = ZONES.map(z => ({
    id: z.id, name: z.name, type: z.type, description: z.desc,
    coordinates: null, isActive: true,
    createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY),
    posts: postsJson.filter(p => p.zoneId === z.id),
    cameras: CAMERAS.slice(0, 3).map(c => ({
      camera: c,
      priority: Math.floor(randBetween(3, 10)),
    })),
  }));

  // ─── 14. audit-log.json ───
  const auditLog = generateAuditLog(allWorkOrders);

  // ═══ WRITE FILES ═══
  const writes = {
    'dashboard-posts.json': dashboardPosts,
    'work-orders.json': workOrdersJson,
    'sessions.json': sessionsJson,
    'sessions-completed.json': sessionsCompletedJson,
    'events.json': { events, total: events.length },
    'dashboard-overview.json': dashboardOverview,
    'recommendations.json': recommendations,
    'shifts.json': shiftsJson,
    'posts-analytics.json': postsAnalytics,
    'analytics-history.json': analyticsHistory,
    'dashboard-metrics-30d.json': metrics30d,
    'dashboard-metrics-7d.json': metrics7d,
    'dashboard-metrics-24h.json': metrics24h,
    'posts.json': postsJson,
    'zones.json': zonesJson,
    'audit-log.json': auditLog,
  };

  for (const [filename, data] of Object.entries(writes)) {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
  }

  console.log(`[DemoGen] Generated ${Object.keys(writes).length} files at ${NOW.toLocaleTimeString()}`);
  console.log(`  WOs: ${allWorkOrders.length} (completed: ${allWorkOrders.filter(w=>w.status==='completed').length}, in_progress: ${allWorkOrders.filter(w=>w.status==='in_progress').length}, scheduled: ${allWorkOrders.filter(w=>w.status==='scheduled').length})`);
  console.log(`  Sessions: ${activeSessions.length} active, ${completedSessions.length} completed`);
  console.log(`  Events: ${events.length}`);
  console.log(`  Posts: ${occupiedPosts.length} occupied, ${freePosts.length} free`);
  console.log(`  Recommendations: ${recommendations.length}`);
}

// ─── Helper: create session object ───
function makeSession(wo, ps, entryTime, exitTime, status) {
  const zone = ZONES.find(z => z.id === ps.zoneId) || ZONES[0];
  return {
    id: uuid(`session-${wo.plateNumber}`),
    plateNumber: wo.plateNumber,
    entryTime: timeStr(entryTime),
    exitTime: exitTime ? timeStr(exitTime) : null,
    status,
    trackId: `track_${wo.plateNumber}`,
    createdAt: timeStr(entryTime),
    updatedAt: timeStr(NOW),
    zoneStays: [{
      id: uuid(`zs-${wo.id}`),
      zoneId: zone.id,
      vehicleSessionId: uuid(`session-${wo.plateNumber}`),
      entryTime: timeStr(entryTime),
      exitTime: exitTime ? timeStr(exitTime) : null,
      duration: exitTime ? Math.floor((exitTime - entryTime) / 1000) : null,
      zone: { id: zone.id, name: zone.name, type: zone.type, description: zone.desc, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
    }],
    postStays: [{
      id: uuid(`ps-${wo.id}`),
      postId: ps.id,
      vehicleSessionId: uuid(`session-${wo.plateNumber}`),
      startTime: wo.startTime,
      endTime: wo.endTime,
      hasWorker: ps.status !== 'occupied_no_work',
      isActive: status === 'active' && ps.status === 'active_work',
      activeTime: Math.floor(wo.normHours * 3600 * 0.75),
      idleTime: Math.floor(wo.normHours * 3600 * 0.25),
      post: { id: ps.id, zoneId: ps.zoneId, name: ps.name, type: ps.type, status: ps.status, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
    }],
  };
}

// ─── Events generator ───
function generateEvents(postStates, activeSessions) {
  const events = [];
  const eventTypes = [
    'vehicle_entered_zone', 'vehicle_left_zone', 'vehicle_moving', 'vehicle_waiting',
    'post_occupied', 'post_vacated', 'worker_present', 'worker_absent',
    'work_activity', 'work_idle',
  ];

  // Generate events for last 2 hours
  const eventStart = addMin(NOW, -120);

  // For each active post — generate work_activity/work_idle events
  postStates.filter(p => p.status !== 'free').forEach(ps => {
    const cam = CAMERAS[ps.number - 1] || CAMERAS[0];
    let t = new Date(eventStart);

    while (t < NOW) {
      const isWork = seededRandom() > 0.3;
      events.push({
        id: uuid(`ev-${ps.number}-${t.getTime()}`),
        type: isWork ? 'work_activity' : 'work_idle',
        zoneId: ps.zoneId,
        postId: ps.id,
        vehicleSessionId: ps.currentWO ? uuid(`session-${ps.currentWO.plateNumber}`) : null,
        cameraId: cam.id,
        cameraSources: JSON.stringify([cam.name.toLowerCase().replace(' ', '')]),
        confidence: roundTo(randBetween(0.78, 0.99), 4),
        startTime: timeStr(t),
        endTime: null,
        rawData: JSON.stringify({ mock: false, source: 'cv_engine_v2' }),
        createdAt: timeStr(t),
        zone: { id: ps.zoneId, name: ps.zoneName, type: ps.zoneType, description: '', coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
        post: { id: ps.id, zoneId: ps.zoneId, name: ps.name, type: ps.type, status: ps.status, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
        vehicleSession: ps.currentWO ? {
          id: uuid(`session-${ps.currentWO.plateNumber}`),
          plateNumber: ps.currentWO.plateNumber,
          entryTime: ps.currentWO.startTime,
          exitTime: null, status: 'active',
          trackId: `track_${ps.currentWO.plateNumber}`,
          createdAt: ps.currentWO.startTime,
          updatedAt: timeStr(NOW),
        } : null,
      });
      t = addMin(t, Math.floor(randBetween(2, 8)));
    }
  });

  // Entry/exit events
  activeSessions.forEach((sess, i) => {
    const entryZone = ZONES[3]; // entry zone
    events.push({
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
      createdAt: sess.entryTime,
      zone: { id: entryZone.id, name: entryZone.name, type: entryZone.type, description: entryZone.desc, coordinates: null, isActive: true, createdAt: timeStr(TODAY), updatedAt: timeStr(TODAY) },
      post: null,
      vehicleSession: { id: sess.id, plateNumber: sess.plateNumber, entryTime: sess.entryTime, exitTime: null, status: 'active', trackId: sess.trackId, createdAt: sess.entryTime, updatedAt: timeStr(NOW) },
    });
  });

  // Sort by time descending
  events.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  return events.slice(0, 200);
}

// ─── Shifts generator ───
function generateShifts(postStates) {
  const shifts = [];
  // Yesterday completed shift
  const yesterday = new Date(TODAY); yesterday.setDate(yesterday.getDate() - 1);
  shifts.push({
    id: uuid('shift-yesterday'),
    name: 'Дневная смена',
    date: yesterday.toISOString().split('T')[0],
    startTime: '08:00', endTime: '20:00',
    status: 'completed',
    notes: 'Смена завершена штатно. Все ЗН выполнены.',
    createdAt: timeStr(yesterday),
    updatedAt: timeStr(yesterday),
    workers: WORKERS.slice(0, 8).map((w, i) => ({
      id: uuid(`sw-y-${i}`), shiftId: uuid('shift-yesterday'),
      name: w.name, role: i < 6 ? 'mechanic' : (i === 6 ? 'master' : 'diagnostician'),
      postId: POSTS[i]?.id || null,
    })),
    workOrdersCount: 38, completedCount: 35,
  });

  // Today active shift
  shifts.push({
    id: uuid('shift-today'),
    name: 'Дневная смена',
    date: TODAY.toISOString().split('T')[0],
    startTime: '08:00', endTime: '20:00',
    status: NOW >= shiftStart && NOW <= shiftEnd ? 'active' : 'planned',
    notes: null,
    createdAt: timeStr(shiftStart),
    updatedAt: timeStr(NOW),
    workers: WORKERS.slice(0, 10).map((w, i) => ({
      id: uuid(`sw-t-${i}`), shiftId: uuid('shift-today'),
      name: w.name, role: i < 8 ? 'mechanic' : (i === 8 ? 'master' : 'diagnostician'),
      postId: POSTS[i]?.id || null,
    })),
    workOrdersCount: postStates.reduce((s, p) => s + p.timeline.length, 0),
    completedCount: postStates.reduce((s, p) => s + p.completedWOs.length, 0),
  });

  // Tomorrow planned shift
  const tomorrow = new Date(TODAY); tomorrow.setDate(tomorrow.getDate() + 1);
  shifts.push({
    id: uuid('shift-tomorrow'),
    name: 'Дневная смена',
    date: tomorrow.toISOString().split('T')[0],
    startTime: '08:00', endTime: '20:00',
    status: 'planned',
    notes: null,
    createdAt: timeStr(NOW),
    updatedAt: timeStr(NOW),
    workers: WORKERS.slice(2, 10).map((w, i) => ({
      id: uuid(`sw-m-${i}`), shiftId: uuid('shift-tomorrow'),
      name: w.name, role: i < 6 ? 'mechanic' : (i === 6 ? 'master' : 'diagnostician'),
      postId: POSTS[i]?.id || null,
    })),
    workOrdersCount: 0, completedCount: 0,
  });

  return { shifts, total: shifts.length };
}

// ─── Posts Analytics generator ───
function generatePostsAnalytics(postStates, allWorkOrders) {
  return postStates.map(ps => {
    const completed = ps.completedWOs.length;
    const inProgress = ps.currentWO ? 1 : 0;
    const totalWOs = ps.timeline.length;
    const normTotal = roundTo(ps.timeline.reduce((s, w) => s + w.normHours, 0), 1);
    const actualTotal = roundTo(ps.completedWOs.reduce((s, w) => s + (w.actualHours || w.normHours), 0), 1);

    const occupancy = ps.status !== 'free'
      ? roundTo(randBetween(55, 90))
      : roundTo(randBetween(20, 50));
    const efficiency = ps.status === 'active_work'
      ? roundTo(randBetween(70, 95))
      : roundTo(randBetween(40, 70));

    // Daily history for last 7 days
    const daily = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(TODAY);
      day.setDate(day.getDate() - d);
      daily.push({
        date: day.toISOString().split('T')[0],
        occupancy: roundTo(randBetween(40, 90)),
        efficiency: roundTo(randBetween(50, 95)),
        vehicles: Math.floor(randBetween(2, 6)),
        workerPresence: roundTo(randBetween(70, 98)),
        activeHours: roundTo(randBetween(4, 10), 1),
        idleHours: roundTo(randBetween(0.5, 3), 1),
      });
    }

    return {
      id: `post-${ps.number}`,
      number: ps.number,
      name: ps.name,
      type: ps.type,
      zone: ps.zoneName,
      status: ps.status,
      occupancy,
      efficiency,
      vehiclesToday: completed + inProgress,
      avgServiceTime: totalWOs > 0 ? roundTo(normTotal / totalWOs, 1) : 0,
      totalNormHours: normTotal,
      totalActualHours: actualTotal,
      completedWOs: completed,
      scheduledWOs: ps.scheduledWOs.length,
      workerPresence: roundTo(randBetween(75, 98)),
      worker: WORKERS[(ps.number - 1) % WORKERS.length].name,
      master: MASTERS[ps.number % MASTERS.length],
      daily,
      workOrders: ps.timeline.map(wo => ({
        orderNumber: wo.orderNumber,
        plateNumber: wo.plateNumber,
        brand: wo.brand,
        model: wo.model,
        workType: wo.workType,
        normHours: wo.normHours,
        actualHours: wo.actualHours,
        status: wo.status,
        startTime: wo.startTime,
        endTime: wo.endTime,
      })),
      alerts: ps.status === 'occupied_no_work' ? [
        { type: 'worker_absent', message: 'Работник отсутствует на посту', time: timeStr(addMin(NOW, -5)) },
      ] : [],
      events: [],
    };
  });
}

// ─── Analytics History (30 days) ───
function generateAnalyticsHistory() {
  const days = [];
  for (let d = 29; d >= 0; d--) {
    const day = new Date(TODAY);
    day.setDate(day.getDate() - d);
    const dateStr = day.toISOString().split('T')[0];
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    const postData = POSTS.map(p => {
      const occ = isWeekend ? roundTo(randBetween(10, 40)) : roundTo(randBetween(50, 95));
      const eff = roundTo(randBetween(50, 95));
      const vehicles = isWeekend ? Math.floor(randBetween(1, 3)) : Math.floor(randBetween(3, 6));
      return {
        postId: p.id, postName: p.name, postNumber: p.number,
        occupancy: occ, efficiency: eff, vehicles,
        activeHours: roundTo(vehicles * randBetween(1.5, 3), 1),
        idleHours: roundTo(randBetween(0.5, 2), 1),
        normHours: roundTo(vehicles * randBetween(1.5, 3), 1),
        actualHours: roundTo(vehicles * randBetween(1.5, 3.5), 1),
        workerPresence: roundTo(randBetween(70, 98)),
      };
    });

    const totalVehicles = postData.reduce((s, p) => s + p.vehicles, 0);
    const avgOccupancy = roundTo(postData.reduce((s, p) => s + p.occupancy, 0) / postData.length);
    const avgEfficiency = roundTo(postData.reduce((s, p) => s + p.efficiency, 0) / postData.length);

    days.push({
      date: dateStr,
      avgOccupancy,
      avgEfficiency,
      totalVehicles,
      totalActiveHours: roundTo(postData.reduce((s, p) => s + p.activeHours, 0), 1),
      totalIdleHours: roundTo(postData.reduce((s, p) => s + p.idleHours, 0), 1),
      totalNoShows: isWeekend ? 0 : Math.floor(randBetween(0, 3)),
      totalNormHours: roundTo(postData.reduce((s, p) => s + p.normHours, 0), 1),
      totalActualHours: roundTo(postData.reduce((s, p) => s + p.actualHours, 0), 1),
      posts: postData,
      // Hourly heatmap for this day
      hourly: Array.from({ length: 12 }, (_, h) => ({
        hour: h + 8,
        posts: POSTS.map(p => ({
          postNumber: p.number,
          occupancy: roundTo(isWeekend ? randBetween(0, 40) : randBetween(30, 100)),
        })),
      })),
    });
  }
  return { period: '30d', days };
}

// ─── Dashboard Metrics ───
function generateMetrics(periodDays) {
  const periods = { 1: '24h', 7: '7d', 30: '30d' };
  return {
    period: periods[periodDays] || `${periodDays}d`,
    zoneMetrics: ZONES.filter(z => z.type !== 'entry').map(z => ({
      zoneId: z.id, zoneName: z.name, zoneType: z.type,
      avgDuration: Math.floor(randBetween(10000, 30000)),
      vehicleCount: Math.floor(randBetween(5, 50) * periodDays),
    })),
    postMetrics: POSTS.map(p => ({
      postId: p.id, postName: p.name,
      activeTime: Math.floor(randBetween(20000, 50000) * periodDays),
      idleTime: Math.floor(randBetween(3000, 15000) * periodDays),
      vehicleCount: Math.floor(randBetween(3, 6) * periodDays),
    })),
    workOrderMetrics: [
      { status: 'completed', count: Math.floor(randBetween(25, 40) * periodDays) },
      { status: 'in_progress', count: Math.floor(randBetween(5, 10)) },
      { status: 'scheduled', count: Math.floor(randBetween(3, 8)) },
      { status: 'no_show', count: Math.floor(randBetween(1, 4) * periodDays) },
    ],
  };
}

// ─── Audit Log ───
function generateAuditLog(allWorkOrders) {
  const logs = [];
  const actions = ['create', 'update'];
  const entities = ['workOrder', 'session', 'shift', 'post', 'user'];

  // Generate 20 recent audit entries
  for (let i = 0; i < 20; i++) {
    const minutesAgo = Math.floor(randBetween(5, 600));
    const action = pick(actions);
    const entity = pick(entities);
    const user = pick(['Старинский Андрей', 'Крылатов Максим', 'Эксузьян Андроник', 'admin']);

    logs.push({
      id: uuid(`audit-${i}`),
      userId: uuid(`user-${user}`),
      userName: user,
      action,
      entity,
      entityId: uuid(`entity-${i}`),
      oldData: action === 'update' ? JSON.stringify({ status: 'scheduled' }) : null,
      newData: JSON.stringify({ status: action === 'create' ? 'scheduled' : 'in_progress' }),
      ip: '192.168.1.' + Math.floor(randBetween(10, 200)),
      createdAt: timeStr(addMin(NOW, -minutesAgo)),
    });
  }

  logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { logs, total: logs.length };
}

// ═══ RUN ═══
generate();

module.exports = { generate };
