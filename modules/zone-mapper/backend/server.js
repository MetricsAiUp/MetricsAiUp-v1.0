const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const roomsRouter = require('./routes/rooms');
const zonesRouter = require('./routes/zones');
const camerasRouter = require('./routes/cameras');

const app = express();
const PORT = process.env.PORT || 3100;
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/rooms', roomsRouter);
app.use('/api/rooms/:roomId/zones', zonesRouter);
app.use('/api/rooms/:roomId/cameras', camerasRouter);

// When served behind a proxy that uses ?port= for routing,
// rewrite asset URLs in HTML to include ?port= so the proxy routes them correctly
app.use((req, res, next) => {
  const portParam = req.query.port;
  if (!portParam) return next();

  // Check if this request should return index.html (non-asset, non-API paths)
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();
  if (req.path.startsWith('/api/')) return next();

  const indexPath = path.join(frontendDist, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  // Add ?port=X to all relative asset references so proxy routes them to this server
  html = html.replace(/(\.\/assets\/[^"]+)"/g, `$1?port=${portParam}"`);
  res.type('html').send(html);
});

// Serve frontend static files
app.use(express.static(frontendDist));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zone Mapper API running on http://0.0.0.0:${PORT}`);
});
