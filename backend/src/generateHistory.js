/**
 * Генерирует реалистичные исторические данные по постам за 30 дней
 * Выходной файл: /project/api/analytics-history.json
 */
const fs = require('fs');
const path = require('path');

const POSTS = [
  { id: 'post-1', name: 'Пост 1', nameEn: 'Post 1', type: 'light' },
  { id: 'post-2', name: 'Пост 2', nameEn: 'Post 2', type: 'light' },
  { id: 'post-3', name: 'Пост 3', nameEn: 'Post 3', type: 'light' },
  { id: 'post-4', name: 'Пост 4', nameEn: 'Post 4', type: 'heavy' },
  { id: 'post-5', name: 'Пост 5', nameEn: 'Post 5', type: 'light' },
  { id: 'post-6', name: 'Пост 6', nameEn: 'Post 6', type: 'light' },
  { id: 'post-7', name: 'Пост 7', nameEn: 'Post 7', type: 'light' },
  { id: 'post-8', name: 'Пост 8', nameEn: 'Post 8', type: 'light' },
  { id: 'post-9', name: 'Пост 9', nameEn: 'Post 9', type: 'special' },
  { id: 'post-10', name: 'Пост 10', nameEn: 'Post 10', type: 'special' },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function generateDayData(date, postIndex) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dayStr = date.toISOString().split('T')[0];

  // Базовые параметры — у каждого поста свой "характер"
  const baseLoad = [0.85, 0.70, 0.80, 0.60, 0.75, 0.55, 0.78, 0.50, 0.90, 0.45][postIndex];
  const weekendFactor = isWeekend ? 0.3 : 1.0;
  const dailyVariation = rand(0.8, 1.2);

  const workdayHours = 12; // рабочий день 8:00-20:00
  const totalMinutes = workdayHours * 60;

  const occupancyRate = Math.min(baseLoad * weekendFactor * dailyVariation, 0.98);
  const occupiedMinutes = Math.round(totalMinutes * occupancyRate);
  const freeMinutes = totalMinutes - occupiedMinutes;

  // Из занятого времени: активная работа vs простой
  const efficiencyBase = [0.82, 0.65, 0.78, 0.70, 0.85, 0.60, 0.73, 0.55, 0.88, 0.50][postIndex];
  const efficiency = Math.min(efficiencyBase * rand(0.85, 1.15), 0.98);
  const activeMinutes = Math.round(occupiedMinutes * efficiency);
  const idleMinutes = occupiedMinutes - activeMinutes;

  // Кол-во авто за день
  const avgServiceTime = [90, 120, 80, 150, 100, 110, 95, 130, 45, 60][postIndex]; // мин на авто
  const vehicleCount = isWeekend ? randInt(0, 2) : Math.max(1, Math.round(occupiedMinutes / avgServiceTime * rand(0.8, 1.2)));

  // Среднее время на авто
  const avgTimePerVehicle = vehicleCount > 0 ? Math.round(occupiedMinutes / vehicleCount) : 0;

  // Среднее время ожидания до постановки на пост
  const avgWaitTime = isWeekend ? randInt(0, 10) : randInt(5, 45);

  // Работник на посту (% времени)
  const workerPresence = Math.min(efficiency * rand(0.95, 1.1), 1.0);

  // ЗН план vs факт
  const plannedOrders = vehicleCount;
  const completedOrders = Math.max(0, plannedOrders - randInt(0, Math.ceil(plannedOrders * 0.15)));
  const noShows = randInt(0, Math.ceil(plannedOrders * 0.1));
  const plannedHours = vehicleCount * (avgServiceTime / 60);
  const actualHours = plannedHours * rand(0.85, 1.25);
  const overtimeCount = actualHours > plannedHours * 1.1 ? randInt(0, 2) : 0;

  return {
    date: dayStr,
    occupancyRate: +occupancyRate.toFixed(3),
    occupiedMinutes,
    freeMinutes,
    activeMinutes,
    idleMinutes,
    efficiency: +efficiency.toFixed(3),
    vehicleCount,
    avgTimePerVehicle,
    avgWaitTime,
    workerPresence: +workerPresence.toFixed(3),
    plannedOrders,
    completedOrders,
    noShows,
    plannedHours: +plannedHours.toFixed(1),
    actualHours: +actualHours.toFixed(1),
    overtimeCount,
  };
}

function generateHourlyData(date, postIndex) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const hours = [];

  for (let h = 8; h < 20; h++) {
    const isRush = (h >= 9 && h <= 12) || (h >= 14 && h <= 17);
    const baseOccupancy = isRush ? rand(0.7, 1.0) : rand(0.2, 0.6);
    const occupancy = isWeekend ? baseOccupancy * 0.3 : baseOccupancy;
    const activeRate = occupancy * rand(0.6, 0.95);

    hours.push({
      hour: h,
      occupancy: +Math.min(occupancy, 1).toFixed(2),
      activeRate: +Math.min(activeRate, occupancy).toFixed(2),
      vehicles: occupancy > 0.5 ? 1 : 0,
    });
  }

  return hours;
}

function generate() {
  const now = new Date();
  const data = {
    generatedAt: now.toISOString(),
    posts: [],
    // Агрегированные данные по всем постам по дням (для общих графиков)
    daily: [],
  };

  // Для каждого поста — данные за 30 дней
  for (let pi = 0; pi < POSTS.length; pi++) {
    const post = POSTS[pi];
    const days = [];

    for (let d = 29; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);

      const dayData = generateDayData(date, pi);
      dayData.hourly = generateHourlyData(date, pi);
      days.push(dayData);
    }

    // Агрегированные метрики за весь период
    const totalDays = days.filter(d => d.vehicleCount > 0).length;
    const summary = {
      avgOccupancy: +(days.reduce((s, d) => s + d.occupancyRate, 0) / 30).toFixed(3),
      avgEfficiency: +(days.reduce((s, d) => s + d.efficiency, 0) / 30).toFixed(3),
      totalVehicles: days.reduce((s, d) => s + d.vehicleCount, 0),
      avgVehiclesPerDay: +(days.reduce((s, d) => s + d.vehicleCount, 0) / totalDays).toFixed(1),
      avgTimePerVehicle: Math.round(days.reduce((s, d) => s + d.avgTimePerVehicle, 0) / totalDays),
      avgWaitTime: Math.round(days.reduce((s, d) => s + d.avgWaitTime, 0) / 30),
      totalActiveHours: +(days.reduce((s, d) => s + d.activeMinutes, 0) / 60).toFixed(1),
      totalIdleHours: +(days.reduce((s, d) => s + d.idleMinutes, 0) / 60).toFixed(1),
      avgWorkerPresence: +(days.reduce((s, d) => s + d.workerPresence, 0) / 30).toFixed(3),
      totalPlannedOrders: days.reduce((s, d) => s + d.plannedOrders, 0),
      totalCompletedOrders: days.reduce((s, d) => s + d.completedOrders, 0),
      totalNoShows: days.reduce((s, d) => s + d.noShows, 0),
      totalPlannedHours: +(days.reduce((s, d) => s + d.plannedHours, 0)).toFixed(1),
      totalActualHours: +(days.reduce((s, d) => s + d.actualHours, 0)).toFixed(1),
      totalOvertimes: days.reduce((s, d) => s + d.overtimeCount, 0),
    };

    data.posts.push({ ...post, summary, days });
  }

  // Агрегированные данные по дням (все посты суммарно)
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dayStr = date.toISOString().split('T')[0];

    const dayAgg = {
      date: dayStr,
      avgOccupancy: 0,
      avgEfficiency: 0,
      totalVehicles: 0,
      totalActiveMinutes: 0,
      totalIdleMinutes: 0,
      totalNoShows: 0,
    };

    for (const post of data.posts) {
      const pd = post.days[29 - d];
      dayAgg.avgOccupancy += pd.occupancyRate;
      dayAgg.avgEfficiency += pd.efficiency;
      dayAgg.totalVehicles += pd.vehicleCount;
      dayAgg.totalActiveMinutes += pd.activeMinutes;
      dayAgg.totalIdleMinutes += pd.idleMinutes;
      dayAgg.totalNoShows += pd.noShows;
    }

    dayAgg.avgOccupancy = +(dayAgg.avgOccupancy / POSTS.length).toFixed(3);
    dayAgg.avgEfficiency = +(dayAgg.avgEfficiency / POSTS.length).toFixed(3);
    data.daily.push(dayAgg);
  }

  const outPath = path.join(__dirname, '../../api/analytics-history.json');
  fs.writeFileSync(outPath, JSON.stringify(data));
  console.log(`[History] Generated 30 days × ${POSTS.length} posts = ${30 * POSTS.length} records`);
  console.log(`[History] Written to ${outPath}`);
}

generate();
