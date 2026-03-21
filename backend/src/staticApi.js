/**
 * Генерирует статические JSON файлы в /project/api/
 * Nginx отдаёт их как обычные файлы на порту 8080
 * Обновляется каждые 3 секунды
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_DIR = path.join(__dirname, '../../api');

// Ensure api dir exists
fs.mkdirSync(API_DIR, { recursive: true });

function writeJson(filename, data) {
  fs.writeFileSync(path.join(API_DIR, filename), JSON.stringify(data));
}

// ===== Auth endpoint (write token file on demand) =====
async function handleAuth() {
  // Pre-generate auth info for the admin user
  const user = await prisma.user.findUnique({
    where: { email: 'admin@metricsai.up' },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return;

  const permissions = new Set();
  const roleNames = [];
  for (const ur of user.roles) {
    roleNames.push(ur.role.name);
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'change-me-in-production', {
    expiresIn: '24h',
  });

  writeJson('auth-login.json', {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  writeJson('auth-me.json', {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: roleNames,
    permissions: [...permissions],
  });
}

// ===== Generate all API data as static JSON =====
async function generateAll() {
  try {
    // Health
    writeJson('health.json', { status: 'ok', timestamp: new Date().toISOString() });

    // Zones with posts
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      include: {
        posts: {
          include: {
            stays: {
              where: { endTime: null },
              include: { vehicleSession: true },
              take: 1,
            },
          },
        },
        cameras: { include: { camera: true } },
        _count: { select: { stays: { where: { exitTime: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    writeJson('zones.json', zones);

    // Posts
    const posts = await prisma.post.findMany({
      where: { isActive: true },
      include: {
        zone: true,
        stays: {
          where: { endTime: null },
          include: { vehicleSession: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    writeJson('posts.json', posts);

    // Active sessions
    const sessions = await prisma.vehicleSession.findMany({
      where: { status: 'active' },
      include: {
        zoneStays: {
          where: { exitTime: null },
          include: { zone: true },
        },
        postStays: {
          where: { endTime: null },
          include: { post: true },
        },
      },
      orderBy: { entryTime: 'desc' },
      take: 50,
    });
    const sessionsTotal = await prisma.vehicleSession.count({ where: { status: 'active' } });
    writeJson('sessions.json', { sessions, total: sessionsTotal });

    // Completed sessions
    const completedSessions = await prisma.vehicleSession.findMany({
      where: { status: 'completed' },
      include: {
        zoneStays: { include: { zone: true } },
        postStays: { include: { post: true } },
      },
      orderBy: { entryTime: 'desc' },
      take: 50,
    });
    writeJson('sessions-completed.json', { sessions: completedSessions, total: completedSessions.length });

    // Events
    const events = await prisma.event.findMany({
      include: { zone: true, post: true, vehicleSession: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const eventsTotal = await prisma.event.count();
    writeJson('events.json', { events, total: eventsTotal });

    // Dashboard overview
    const [activeSessionsCount, zonesWithVehicles, postsStatus, activeRecommendations] = await Promise.all([
      prisma.vehicleSession.count({ where: { status: 'active' } }),
      prisma.zoneStay.groupBy({ by: ['zoneId'], where: { exitTime: null }, _count: true }),
      prisma.post.groupBy({ by: ['status'], where: { isActive: true }, _count: true }),
      prisma.recommendation.count({ where: { status: 'active' } }),
    ]);
    writeJson('dashboard-overview.json', {
      activeSessions: activeSessionsCount,
      zonesWithVehicles,
      postsStatus,
      activeRecommendations,
    });

    // Metrics
    for (const period of ['24h', '7d', '30d']) {
      const since = new Date();
      if (period === '24h') since.setHours(since.getHours() - 24);
      else if (period === '7d') since.setDate(since.getDate() - 7);
      else if (period === '30d') since.setDate(since.getDate() - 30);

      const [zoneMetrics, postMetrics, workOrderMetrics] = await Promise.all([
        prisma.zoneStay.groupBy({
          by: ['zoneId'],
          where: { entryTime: { gte: since }, duration: { not: null } },
          _avg: { duration: true },
          _count: true,
        }),
        prisma.postStay.groupBy({
          by: ['postId'],
          where: { startTime: { gte: since } },
          _avg: { activeTime: true, idleTime: true },
          _count: true,
        }),
        prisma.workOrder.groupBy({
          by: ['status'],
          where: { scheduledTime: { gte: since } },
          _count: true,
        }),
      ]);
      writeJson(`dashboard-metrics-${period}.json`, { zoneMetrics, postMetrics, workOrderMetrics, period });
    }

    // Work orders
    const orders = await prisma.workOrder.findMany({
      include: {
        links: { include: { vehicleSession: true, postStay: true } },
      },
      orderBy: { scheduledTime: 'desc' },
      take: 50,
    });
    const ordersTotal = await prisma.workOrder.count();
    writeJson('work-orders.json', { orders, total: ordersTotal });

    // Recommendations
    const recommendations = await prisma.recommendation.findMany({
      where: { status: 'active' },
      include: { zone: true, post: true },
      orderBy: { createdAt: 'desc' },
    });
    writeJson('recommendations.json', recommendations);

  } catch (err) {
    console.error('[StaticAPI] Error:', err.message);
  }
}

// Run
async function start() {
  console.log('[StaticAPI] Generating static JSON files...');
  await handleAuth();
  await generateAll();
  console.log('[StaticAPI] Initial generation complete. Refreshing every 3s...');

  setInterval(generateAll, 3000);
}

start().catch(console.error);
