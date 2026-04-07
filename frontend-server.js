// Frontend HTTPS server on port 443
// Serves static files from /project + proxies /api/ to backend on 3001
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const SSL_CERT = '/project/.ssl/fullchain.pem';
const SSL_KEY = '/project/.ssl/privkey.pem';
const PORT = 443;
const BACKEND = 'http://127.0.0.1:3001';
const ROOT = '/project';

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
};

const server = https.createServer({
  cert: fs.readFileSync(SSL_CERT),
  key: fs.readFileSync(SSL_KEY),
}, (req, res) => {
  const url = req.url.split('?')[0];

  // Proxy /api/* and /socket.io/* to backend
  if (url.startsWith('/api/') || url.startsWith('/socket.io/')) {
    const opts = {
      hostname: '127.0.0.1',
      port: 3001,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3001' },
    };
    const proxy = http.request(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('Backend unavailable'); });
    req.pipe(proxy);
    return;
  }

  // Static files
  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      filePath = path.join(ROOT, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    stream.on('open', () => {
      res.writeHead(200, { 'Content-Type': contentType });
      stream.pipe(res);
    });
    stream.on('error', () => {
      res.writeHead(500);
      res.end('Internal error');
    });
  });
});

// WebSocket upgrade proxy for Socket.IO
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io/')) {
    const opts = {
      hostname: '127.0.0.1', port: 3001, path: req.url, method: 'GET',
      headers: { ...req.headers, host: 'localhost:3001' },
      rejectUnauthorized: false,
    };
    const proxy = http.request(opts);
    proxy.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
        Object.entries(proxyRes.headers).map(([k,v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
      if (proxyHead.length) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxy.on('error', () => socket.destroy());
    proxy.end();
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Frontend] https://artisom.dev.metricsavto.com/`);
  console.log(`[Frontend] Proxying /api/ → https://localhost:3001`);
});
