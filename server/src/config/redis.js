const IORedis = require('ioredis');
const { env } = require('./env');
const logger = require('../utils/logger');

// BullMQ requires maxRetriesPerRequest: null on its connections.
function createRedis(name = 'app') {
  const client = new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: false });
  let lastError = '';
  client.on('ready', () => logger.info(`Redis ready (${name})`));
  client.on('error', (err) => {
    // Avoid flooding the log with the same error every reconnect attempt.
    if (err.message !== lastError) logger.error(`Redis error (${name}): ${err.message}`);
    lastError = err.message;
  });
  return client;
}

let shared;
const getRedis = () => (shared ||= createRedis('shared'));

module.exports = { createRedis, getRedis };
