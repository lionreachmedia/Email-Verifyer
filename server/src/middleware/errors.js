const multer = require('multer');
const logger = require('../utils/logger');
const { env } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 20 MB).' : `Upload error: ${err.message}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'That record already exists.';
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    status = 400;
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl} → ${err.stack || err.message}`);
  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? 'Internal server error' : message,
    ...(err.extra || {}),
  });
}

module.exports = { notFound, errorHandler };
