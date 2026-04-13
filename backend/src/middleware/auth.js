const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const authCache = require('../config/authCache');

// Derive pages from role (matches frontend PAGE_PERMISSIONS)
const ROLE_PAGES = {
  admin: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'map-view', 'map-editor', 'sessions', 'work-orders', 'events', 'analytics', 'cameras', 'camera-mapping', 'data-1c', 'users'],
  director: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'cameras'],
  manager: ['dashboard', 'dashboard-posts', 'posts-detail', 'map', 'sessions', 'work-orders', 'events', 'analytics', 'data-1c'],
  mechanic: ['dashboard', 'dashboard-posts', 'map'],
  viewer: ['dashboard', 'posts-detail', 'map'],
};

function buildReqUser(user) {
  const permissions = new Set();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  const roleNames = user.roles.map((ur) => ur.role.name);
  const primaryRole = roleNames[0] || 'viewer';

  let hiddenElements = [];
  try { hiddenElements = JSON.parse(user.hiddenElements || '[]'); } catch {}

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: roleNames,
    role: primaryRole,
    pages: ROLE_PAGES[primaryRole] || ['dashboard'],
    hiddenElements,
    permissions: [...permissions],
  };
}

// Проверка JWT токена
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Reject refresh tokens used as access tokens
    if (payload.type === 'refresh') {
      return res.status(401).json({ error: 'Используйте access token' });
    }

    // Проверяем кэш
    const cached = authCache.get(payload.userId);
    if (cached) {
      req.user = cached;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    req.user = buildReqUser(user);
    authCache.set(payload.userId, req.user);

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

// Проверка permission
function requirePermission(...keys) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    const hasPermission = keys.some((key) => req.user.permissions.includes(key));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = { authenticate, requirePermission };
