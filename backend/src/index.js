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
const { startFileWatcher } = require('./services/sync1C');
const { initTelegramBot } = require('./services/telegramBot');
const { generate: generateDemoData } = require('./generateDemoData');

const app = express();

// Create HTTP server (for nginx proxy on localhost)
const server = http.createServer(app);
const io = initSocket(server);

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
  console.log('[Server] SSL certificates loaded');
}

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
const PROXY_PORT = 8080; // VPS proxies artisom.dev.metricsavto.com → container:8080

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP running on http://0.0.0.0:${PORT}`);
  console.log(`[Socket.IO] Ready for connections`);
  startFileWatcher();
  initTelegramBot();

  // Demo data auto-refresh: regenerate every 2 minutes so data "lives"
  try { generateDemoData(); } catch (e) { console.error('[DemoGen] Initial run error:', e.message); }
  setInterval(() => {
    try { generateDemoData(); } catch (e) { console.error('[DemoGen] Refresh error:', e.message); }
  }, 2 * 60 * 1000);
});

// Also listen on 8080 for VPS proxy (same app, just another HTTP server)
if (parseInt(PORT) !== PROXY_PORT) {
  const proxyServer = http.createServer(app);
  initSocket(proxyServer);
  proxyServer.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`[Server] HTTP running on http://0.0.0.0:${PROXY_PORT} (VPS proxy)`);
    console.log(`[Server] Frontend: https://artisom.dev.metricsavto.com/`);
  });
}

// HTTPS for direct external access
if (httpsServer) {
  const HTTPS_PORT = parseInt(PORT) + 443;
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`[Server] HTTPS running on https://0.0.0.0:${HTTPS_PORT}`);
  });
}

// Keep alive — don't crash on uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[Server] Unhandled rejection:', err?.message || err);
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
