const jwt = require('jsonwebtoken');

let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // Allow anonymous for now (fallback)
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
    } catch { /* invalid token — still allow connection for read-only */ }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}${socket.userId ? ` (user: ${socket.userId})` : ''}`);

    // Подписка на обновления зоны
    socket.on('subscribe:zone', (zoneId) => {
      socket.join(`zone:${zoneId}`);
    });

    // Подписка на обновления поста
    socket.on('subscribe:post', (postId) => {
      socket.join(`post:${postId}`);
    });

    // Подписка на все события
    socket.on('subscribe:all', () => {
      socket.join('all_events');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { initSocket, getIO };
