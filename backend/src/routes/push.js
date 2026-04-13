const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const logger = require('../config/logger');

let webpush;
try {
  webpush = require('web-push');
  // Generate VAPID keys if not set
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@metricsai.up',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } else {
    const vapidKeys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails('mailto:admin@metricsai.up', vapidKeys.publicKey, vapidKeys.privateKey);
    logger.info('Generated VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env for persistence');
    logger.info('VAPID public key', { publicKey: vapidKeys.publicKey });
    process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
    process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey;
  }
} catch (err) {
  logger.info('web-push not available', { error: err.message });
}

// GET /api/push/vapid-key — get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/push/subscribe — save push subscription
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { keys: JSON.stringify(keys), userId: req.user.id },
      create: { endpoint, keys: JSON.stringify(keys), userId: req.user.id },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/send — send push to a user (admin only)
router.post('/send', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { userId, title, body, url } = req.body;
    if (!webpush) return res.status(503).json({ error: 'Push not configured' });

    const subs = userId
      ? await prisma.pushSubscription.findMany({ where: { userId } })
      : await prisma.pushSubscription.findMany();

    const payload = JSON.stringify({ title, body, url });
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: JSON.parse(sub.keys) }, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
    res.json({ sent, total: subs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
