const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createUserSchema, updateUserSchema } = require('../schemas/users');
const authCache = require('../config/authCache');

// Role-to-pages mapping (mirrors frontend PAGE_PERMISSIONS keys)
const ROLE_DEFAULT_PAGES = {
  admin: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'sessions', 'work-orders',
    'shifts', 'events', 'analytics', 'cameras', 'data-1c', 'discrepancies',
    'users', 'map-view', 'map-editor', 'audit', 'health', 'my-post',
    'report-schedule', 'tech-docs', 'live-debug',
  ],
  manager: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view',
    'sessions', 'work-orders', 'shifts', 'analytics', 'events', 'data-1c', 'discrepancies',
  ],
  mechanic: [
    'dashboard', 'dashboard-posts', 'posts-detail', 'map-view', 'sessions', 'my-post',
  ],
  viewer: [
    'dashboard', 'dashboard-posts', 'map-view',
  ],
};

// Common include for user queries (roles + permissions)
const USER_INCLUDE = {
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
};

/**
 * Format a raw Prisma user (with roles included) into the shape
 * the frontend expects: { id, email, firstName, lastName, role, roles, pages, permissions, isActive, ... }
 */
function formatUser(user) {
  const roleNames = user.roles.map((ur) => ur.role.name);
  const primaryRole = roleNames[0] || 'viewer';

  // Collect all permission keys
  const permissions = new Set();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      permissions.add(rp.permission.key);
    }
  }

  // Use saved pages if present, otherwise derive from primary role
  let pages;
  try { pages = JSON.parse(user.pages || '[]'); } catch { pages = []; }
  if (!pages.length) pages = ROLE_DEFAULT_PAGES[primaryRole] || ROLE_DEFAULT_PAGES.viewer;

  let hiddenElements = [];
  try { hiddenElements = JSON.parse(user.hiddenElements || '[]'); } catch {}

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: primaryRole,
    roles: roleNames,
    pages,
    hiddenElements,
    permissions: [...permissions],
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// All routes require authentication
router.use(authenticate);

// -------------------------------------------------------
// GET /api/users — List all users
// -------------------------------------------------------
router.get('/', requirePermission('manage_users'), async (req, res) => {
  try {
    const { active } = req.query; // ?active=true|false
    const where = {};
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const users = await prisma.user.findMany({
      where,
      include: USER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Return in format expected by frontend: { users, roles, availablePages }
    const ROLES = [
      { id: 'admin', name: { ru: 'Администратор', en: 'Administrator' }, color: '#6366f1' },
      { id: 'manager', name: { ru: 'Менеджер', en: 'Manager' }, color: '#22c55e' },
      { id: 'viewer', name: { ru: 'Наблюдатель', en: 'Viewer' }, color: '#3b82f6' },
      { id: 'mechanic', name: { ru: 'Механик', en: 'Mechanic' }, color: '#f59e0b' },
    ];
    const AVAILABLE_PAGES = [
      { id: 'dashboard', label: { ru: 'Дашборд', en: 'Dashboard' } },
      { id: 'dashboard-posts', label: { ru: 'Дашборд постов', en: 'Posts Dashboard' } },
      { id: 'posts-detail', label: { ru: 'Посты и зоны', en: 'Posts & Zones' } },
      { id: 'sessions', label: { ru: 'Сессии авто', en: 'Sessions' } },
      { id: 'work-orders', label: { ru: 'Заказ-наряды', en: 'Work Orders' } },
      { id: 'shifts', label: { ru: 'Смены', en: 'Shifts' } },
      { id: 'events', label: { ru: 'Журнал событий', en: 'Events' } },
      { id: 'analytics', label: { ru: 'Аналитика', en: 'Analytics' } },
      { id: 'cameras', label: { ru: 'Камеры', en: 'Cameras' } },
      { id: 'data-1c', label: { ru: 'Данные 1С', en: '1C Data' } },
      { id: 'discrepancies', label: { ru: 'Нестыковки', en: 'Discrepancies' } },
      { id: 'users', label: { ru: 'Пользователи', en: 'Users' } },
      { id: 'map-view', label: { ru: 'Карта СТО', en: 'STO Map' } },
      { id: 'map-editor', label: { ru: 'Редактор карты', en: 'Map Editor' } },
      { id: 'audit', label: { ru: 'Аудит-лог', en: 'Audit Log' } },
      { id: 'health', label: { ru: 'Здоровье системы', en: 'System Health' } },
      { id: 'my-post', label: { ru: 'Мой пост', en: 'My Post' } },
      { id: 'report-schedule', label: { ru: 'Расписание отчётов', en: 'Report Schedule' } },
      { id: 'tech-docs', label: { ru: 'Документация', en: 'Documentation' } },
      { id: 'live-debug', label: { ru: 'Live-отладка', en: 'Live Debug' } },
    ];
    res.json({ users: users.map(formatUser), roles: ROLES, availablePages: AVAILABLE_PAGES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// GET /api/users/:id — Get single user
// -------------------------------------------------------
router.get('/:id', requirePermission('manage_users'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: USER_INCLUDE,
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// POST /api/users — Create user
// -------------------------------------------------------
router.post('/', requirePermission('manage_users'), validate(createUserSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, roleIds, roleName, pages, hiddenElements } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, password, firstName и lastName обязательны' });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Resolve role IDs
    let resolvedRoleIds = roleIds;
    if (!resolvedRoleIds && roleName) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) resolvedRoleIds = [role.id];
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        pages: pages ? JSON.stringify(pages) : '[]',
        hiddenElements: hiddenElements ? JSON.stringify(hiddenElements) : '[]',
        roles: {
          create: (resolvedRoleIds || []).map((roleId) => ({ roleId })),
        },
      },
      include: USER_INCLUDE,
    });

    res.status(201).json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// PUT /api/users/:id — Update user
// -------------------------------------------------------
router.put('/:id', requirePermission('manage_users'), validate(updateUserSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName, roleIds, isActive, hiddenElements, roleName, pages } = req.body;

    // Check user exists
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Check email uniqueness if changing
    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
    }

    // Build update data
    const data = {};
    if (email !== undefined) data.email = email;
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (isActive !== undefined) data.isActive = isActive;
    if (hiddenElements !== undefined) data.hiddenElements = JSON.stringify(hiddenElements);
    if (pages !== undefined) data.pages = JSON.stringify(pages);
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    // Update roles if provided: delete existing, recreate
    let resolvedRoleIds = roleIds;
    if (!resolvedRoleIds && roleName) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) resolvedRoleIds = [role.id];
    }
    if (resolvedRoleIds !== undefined) {
      await prisma.userRole.deleteMany({ where: { userId: id } });
      data.roles = {
        create: resolvedRoleIds.map((roleId) => ({ roleId })),
      };
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: USER_INCLUDE,
    });

    authCache.invalidate(id);

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------
// DELETE /api/users/:id — Soft delete (deactivate)
// -------------------------------------------------------
router.delete('/:id', requirePermission('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deactivation
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя деактивировать собственный аккаунт' });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    authCache.invalidate(id);

    res.json({ message: 'Пользователь деактивирован', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/me/ui-state — merge JSON-патча в User.uiState
router.patch('/me/ui-state', authenticate, async (req, res) => {
  try {
    const patch = req.body?.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'patch must be an object' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { uiState: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    let current = {};
    try { current = user.uiState ? JSON.parse(user.uiState) : {}; } catch { current = {}; }
    if (typeof current !== 'object' || Array.isArray(current) || current === null) current = {};
    const next = { ...current, ...patch };
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { uiState: JSON.stringify(next) },
      select: { id: true, uiState: true },
    });
    authCache.invalidate(req.user.id);
    res.json({ uiState: JSON.parse(updated.uiState) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
