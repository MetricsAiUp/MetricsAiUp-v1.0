const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getHealth } = require('../services/healthMetrics');

// GET /api/system-health — расширенный health-snapshot для admin-страницы Health.
// Кэшируется на 5с внутри healthMetrics, чтобы частые запросы не нагружали систему.
router.get('/', authenticate, async (req, res) => {
  try {
    const noCache = req.query.fresh === '1';
    const data = await getHealth({ noCache });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
