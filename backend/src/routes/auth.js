const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, buildReqUser } = require('../middleware/auth');
const authCache = require('../config/authCache');
const { validate } = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../schemas/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

// --- Rate limiting (in-memory, per-IP) ---
const loginAttempts = new Map(); // ip → { count, firstAttempt }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 attempts per minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000);

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and get JWT tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns access token and user info
 *       401:
 *         description: Invalid email or password
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите минуту.' });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({
      token: accessToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    });
  } catch (err) {
    console.error('[Auth] /login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token and rotated refresh cookie
 *       401:
 *         description: Refresh token missing, expired, or invalid
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token отсутствует' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Невалидный refresh token' });
    }

    // Перечитываем юзера с ролями/пермишенами, чтобы клиент получил актуальные права
    // (например после смены роли админом — без выхода/входа).
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Сбрасываем authCache, чтобы следующий запрос с новым access-токеном
    // взял свежие данные из БД, а не закэшированные.
    authCache.invalidate(user.id);

    // Rotate: issue new pair
    const { accessToken, refreshToken: newRefresh } = generateTokens(user.id);
    setRefreshCookie(res, newRefresh);

    res.json({
      token: accessToken,
      user: buildReqUser(user),
    });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({ error: 'Refresh token истёк или невалиден' });
  }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout and clear refresh cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Refresh cookie cleared
 */
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'OK' });
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user object with roles and permissions
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post('/register', authenticate, validate(registerSchema), async (req, res) => {
  if (!req.user.permissions.includes('manage_users')) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  try {
    const { email, password, firstName, lastName, roleIds } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashed,
        firstName,
        lastName,
        roles: {
          create: (roleIds || []).map((roleId) => ({ roleId })),
        },
      },
    });

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    console.error('[Auth] /register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
