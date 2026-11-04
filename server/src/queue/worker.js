const { Worker } = require('bullmq');
const { createRedis, getRedis } = require('../config/redis');
const { env } = require('../config/env');
const { QUEUE_NAME } = require('./index');
const { verifyEmail } = require('../services/verification');
const bulk = require('../services/bulk');
const BulkJob = require('../models/BulkJob');
const logger = require('../utils/logger');

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const failedResult = (email, message) => ({
  email, status: 'unknown', reason: 'internal_error', details: `Verification failed: ${message}`,
  confidence: null, syntaxValid: true, mailbox: 'unknown', provider: 'local', durationMs: 0,
});

async function processBatch(job) {
  const { jobId, userId, emails, batchIndex } = job.data;
  const parent = await BulkJob.findOne({ jobId }).select('status').lean();
  if (!parent || parent.status === 'failed' || parent.status === 'completed') return { skipped: true };

  const done = await bulk.alreadyDone(jobId, emails);
  const todo = emails.filter((e) => !done.has(e));
  const results = await mapLimit(todo, env.verify.emailConcurrency, async (email) => {
    try { return await verifyEmail(email); } catch (err) {
      logger.error(`[worker] ${email}: ${err.message}`);
      return failedResult(email, err.message);
    }
  });
  await bulk.recordResults(jobId, userId, results);
  logger.debug(`[worker] ${jobId} batch ${batchIndex}: ${results.length} verified`);
  return { verified: results.length };
}

function startWorker() {
  const worker = new Worker(QUEUE_NAME, processBatch, {
    connection: createRedis('worker'),
    concurrency: env.verify.workerConcurrency,
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    logger.error(`[worker] batch ${job.id} attempt ${job.attemptsMade} failed: ${err.message}`);
    // Out of retries: record the remaining emails as "unknown" so the job still finishes.
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      try {
        const { jobId, userId, emails } = job.data;
        const done = await bulk.alreadyDone(jobId, emails);
        await bulk.recordResults(jobId, userId, emails.filter((e) => !done.has(e)).map((e) => failedResult(e, err.message)));
      } catch (e) { logger.error(`[worker] could not record failed batch: ${e.message}`); }
    }
  });
  worker.on('error', (err) => logger.error(`[worker] ${err.message}`));

  // Heartbeat so the API/UI can tell whether a worker is running.
  const redis = getRedis();
  const beat = () => redis.set('mg:worker:heartbeat', Date.now(), 'EX', 60).catch(() => {});
  beat();
  const timer = setInterval(beat, 15000);
  worker.on('closed', () => clearInterval(timer));

  logger.info(`[worker] listening on "${QUEUE_NAME}" (batches in parallel: ${env.verify.workerConcurrency}, emails per batch in parallel: ${env.verify.emailConcurrency})`);
  return worker;
}

module.exports = { startWorker, processBatch, mapLimit };
