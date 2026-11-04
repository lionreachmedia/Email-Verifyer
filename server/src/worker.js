const { assertEnv } = require('./config/env');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');
const cache = require('./services/verification/cache');

async function main() {
  assertEnv();
  await connectDB();
  cache.useRedis(getRedis());
  const worker = require('./queue/worker').startWorker();

  const stop = async () => {
    logger.info('[worker] shutting down…');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
