require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./config/logger');

const { initSocket } = require('./config/socket');
const prisma = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const zoneRoutes = require('./routes/zones');
const postRoutes = require('./routes/posts');
const eventRoutes = require('./routes/events');
const sessionRoutes = require('./routes/sessions');
const workOrderRoutes = require('./routes/workOrders');
const recommendationRoutes = require('./routes/recommendations');
const dashboardRoutes = require('./routes/dashboard');
const cameraRoutes = require('./routes/cameras');
const userRoutes = require('./routes/users');
const mapLayoutRoutes = require('./routes/mapLayout');
const data1cRoutes = require('./routes/data1c');
const shiftsRoutes = require('./routes/shifts');
const auditLogRoutes = require('./routes/auditLog');
const pushRoutes = require('./routes/push');
const photosRoutes = require('./routes/photos');
const locationsRoutes = require('./routes/locations');
const predictRoutes = require('./routes/predict');
const postsDataRoutes = require('./routes/postsData');
const healthRoutes = require('./routes/health');
const workersRoutes = require('./routes/workers');
const { startFileWatcher } = require('./services/sync1C');
const { initTelegramBot } = require('./services/telegramBot');
const { generate: generateDemoData } = require('./generateDemoData');
const { startCameraHealthCheck } = require('./services/cameraHealthCheck');
const { startReportScheduler } = require('./services/reportScheduler');
const monitoringProxy = require('./services/monitoringProxy');
const settingsRoutes = require('./routes/settings');
const cameraMappingRoutes = require('./routes/cameraMapping');

const app = express();

// Create HTTP server (for nginx proxy on localhost)
const server = http.createServer(app);
const io = initSocket(server);
app.set('io', io);

// Also create HTTPS server if SSL certs available (for direct external access)
const SSL_CERT = '/project/.ssl/fullchain.pem';
const SSL_KEY = '/project/.ssl/privkey.pem';
let httpsServer;
if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  httpsServer = https.createServer({
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY),
  }, app);
  initSocket(httpsServer);
  logger.info('SSL certificates loaded');
}

// Swagger API docs
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'MetricsAiUp API', version: '1.0.0', description: 'API мониторинга СТО' },
    servers: [
      { url: 'https://artisom.dev.metricsavto.com', description: 'HTTPS' },
      { url: 'http://localhost:3001', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/users', userRoutes);
app.use('/api/map-layout', mapLayoutRoutes);
app.use('/api/1c', data1cRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api', postsDataRoutes);
app.use('/api/system-health', healthRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/report-schedules', require('./routes/reportSchedule'));
app.use('/api/settings', settingsRoutes);
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/camera-mapping', cameraMappingRoutes);
app.use('/predict', predictRoutes); // backward compat with ML service URL

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend + static files from /project (data/*.json, assets/*)
const projectRoot = path.join(__dirname, '../..');
app.use(express.static(projectRoot));
app.get('*', (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  logger.info('HTTP server started', { port: PORT });
  logger.info('Socket.IO ready for connections');
  startFileWatcher();
  initTelegramBot();
  startCameraHealthCheck();
  startReportScheduler();

  // Demo data auto-refresh: controlled by app mode setting
  let demoInterval = null;
  const demoControl = {
    start() {
      if (demoInterval) return;
      logger.info('Starting demo data generator');
      generateDemoData().catch(e => logger.error('DemoGen initial run error', { error: e.message }));
      demoInterval = setInterval(() => {
        generateDemoData().catch(e => logger.error('DemoGen refresh error', { error: e.message }));
      }, 2 * 60 * 1000);
    },
    stop() {
      if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
        logger.info('Stopped demo data generator');
      }
    },
  };
  app.set('demoControl', demoControl);

  // Monitoring proxy control (for live mode)
  const monitoringControl = {
    start() { monitoringProxy.start(io); },
    stop() { monitoringProxy.stop(); },
  };
  app.set('monitoringControl', monitoringControl);
  app.set('monitoringProxy', monitoringProxy);

  // Start demo generator only if mode is 'demo', monitoring proxy if 'live'
  const appSettings = settingsRoutes.readSettings();
  if (appSettings.mode === 'demo') {
    demoControl.start();
  } else {
    logger.info('Mode is "live" — demo generator disabled, starting monitoring proxy');
    monitoringControl.start();
  }
});


// HTTPS for direct external access
if (httpsServer) {
  const HTTPS_PORT = 443;
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    logger.info('HTTPS server started', { port: HTTPS_PORT });
  });
}

// Keep alive — don't crash on uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message });
});
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { error: err?.message || err });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit();
});
