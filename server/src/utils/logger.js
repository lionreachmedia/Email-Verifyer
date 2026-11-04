const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logDir = path.resolve(__dirname, '../../logs');
fs.mkdirSync(logDir, { recursive: true });

const line = winston.format.printf(({ timestamp, level, message, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    line,
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'HH:mm:ss' }), line),
    }),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error', maxsize: 5e6, maxFiles: 3 }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log'), maxsize: 10e6, maxFiles: 3 }),
  ],
});

module.exports = logger;
