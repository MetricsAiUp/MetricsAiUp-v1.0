const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }))
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: '/project/logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
    new transports.File({
      filename: '/project/logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
