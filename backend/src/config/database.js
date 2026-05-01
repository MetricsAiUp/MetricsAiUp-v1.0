const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// SQLite pragmas: WAL устраняет блокировки между параллельными писателями
// (demoGenerator, monitoringProxy, API), busy_timeout страхует от случайных
// SQLITE_BUSY, synchronous=NORMAL — рекомендованный режим в WAL.
// foreign_keys=ON в Prisma 5+ включаются драйвером автоматически.
// Используем $queryRawUnsafe, т.к. assignment-формы PRAGMA возвращают
// новое значение, а $executeRawUnsafe на это падает.
(async () => {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000');
  } catch (err) {
    console.error('Failed to set SQLite pragmas:', err);
  }
})();

module.exports = prisma;
