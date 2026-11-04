const { env, assertEnv } = require('./config/env');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');
const cache = require('./services/verification/cache');
const { providersStatus } = require('./services/verification');

async function main() {
  assertEnv();
  await connectDB();
  cache.useRedis(getRedis());

  const app = require('./app');
  if (process.env.RUN_WORKER === 'true') require('./queue/worker').startWorker();

  app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
    const p = providersStatus();
    logger.info(`Mailbox providers: ${p.map((x) => `${x.name}${x.configured ? '' : ' (NOT configured)'}`).join(' → ') || 'none'}`);
    if (!p.some((x) => x.configured)) logger.warn('No mailbox provider is configured: results will be "unknown" for real domains. Run "npm run doctor".');
  });
}

main().catch((err) => {
  logger.error(err.message);
  process.exit(1);
});
