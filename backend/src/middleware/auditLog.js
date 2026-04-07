const prisma = require('../config/database');

/**
 * Middleware factory for audit logging.
 * Usage: router.post('/endpoint', authenticate, auditLog('create', 'entity'), handler)
 */
function auditLog(action, entity) {
  return async (req, res, next) => {
    // Store original json method to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Only log successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const logEntry = {
          userId: req.user?.id || null,
          userName: req.user ? `${req.user.firstName} ${req.user.lastName}` : null,
          action,
          entity,
          entityId: req.params.id || data?.id || null,
          oldData: req._auditOldData ? JSON.stringify(req._auditOldData) : null,
          newData: JSON.stringify(req.body || {}),
          ip: req.ip || req.connection?.remoteAddress || null,
        };

        // Fire and forget — don't block the response
        prisma.auditLog.create({ data: logEntry }).catch(err => {
          console.error('Audit log error:', err.message);
        });
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Middleware to capture old data before update/delete.
 * Usage: router.put('/:id', authenticate, captureOldData('User'), auditLog('update', 'user'), handler)
 */
function captureOldData(model) {
  return async (req, res, next) => {
    try {
      const id = req.params.id;
      if (id && prisma[model.charAt(0).toLowerCase() + model.slice(1)]) {
        const old = await prisma[model.charAt(0).toLowerCase() + model.slice(1)].findUnique({ where: { id } });
        if (old) req._auditOldData = old;
      }
    } catch { /* ignore */ }
    next();
  };
}

module.exports = { auditLog, captureOldData };
