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
const { startFileWatcher } = require('./services/sync1C');

const app = express();

// HTTPS with SSL certificates
const SSL_CERT = '/project/.ssl/fullchain.pem';
const SSL_KEY = '/project/.ssl/privkey.pem';
let server;
if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  server = https.createServer({
    cert: fs.readFileSync(SSL_CERT),
    key: fs.readFileSync(SSL_KEY),
  }, app);
  console.log('[Server] SSL certificates loaded');
} else {
  server = http.createServer(app);
  console.log('[Server] No SSL certificates found, using HTTP');
}
const io = initSocket(server);

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

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  const proto = fs.existsSync(SSL_CERT) ? 'https' : 'http';
  console.log(`[Server] Running on ${proto}://0.0.0.0:${PORT}`);
  console.log(`[Server] External: https://artisom.dev.metricsavto.com:${PORT}/`);
  console.log(`[Socket.IO] Ready for connections`);

  // Start 1C file watcher (checks /project/data/1c-import/ every 5 minutes)
  startFileWatcher();
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
