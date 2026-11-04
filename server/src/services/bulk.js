/**
 * Bulk job bookkeeping shared by the API (enqueue) and the worker (record results).
 * Every write is idempotent: a retried batch never double-counts or duplicates rows.
 */
const { randomUUID: uuid } = require('crypto');
const BulkJob = require('../models/BulkJob');
const Verification = require('../models/Verification');
const User = require('../models/User');
const { getQueue } = require('../queue');
const { env } = require('../config/env');
const credits = require('./credits');
const logger = require('../utils/logger');

const COUNT_FIELD = { valid: 'valid', invalid: 'invalid', risky: 'risky', 'catch-all': 'catchAll', unknown: 'unknown' };

async function createJob({ user, fileName, emails, duplicates }) {
  await credits.charge(user._id, emails.length);

  const jobId = uuid();
  try {
    await BulkJob.create({
      userId: user._id, jobId, fileName, totalEmails: emails.length,
      duplicatesRemoved: duplicates, creditsCharged: emails.length, status: 'queued',
    });

    const size = env.verify.bulkBatchSize;
    const batches = [];
    for (let i = 0; i < emails.length; i += size) {
      batches.push({
        name: `${jobId}-${batches.length}`,
        data: { jobId, userId: String(user._id), emails: emails.slice(i, i + size), batchIndex: batches.length },
        opts: { jobId: `${jobId}-b${batches.length}` }, // stable id → never enqueued twice
      });
    }
    const queue = getQueue();
    for (let i = 0; i < batches.length; i += 500) await queue.addBulk(batches.slice(i, i + 500));
    logger.info(`[bulk] ${jobId}: ${emails.length} emails in ${batches.length} batches`);
    return { jobId, totalEmails: emails.length, batches: batches.length };
  } catch (err) {
    await credits.refund(user._id, emails.length);
    await BulkJob.updateOne({ jobId }, { status: 'failed', error: 'Could not queue the job: ' + err.message });
    throw err;
  }
}

/** Save results for a batch. Only rows that are new get counted. */
async function recordResults(jobId, userId, results) {
  if (!results.length) return;
  const ops = results.map((r) => ({
    updateOne: {
      filter: { bulkJobId: jobId, email: r.email },
      update: { $setOnInsert: { ...r, userId, bulkJobId: jobId } },
      upsert: true,
    },
  }));
  const bw = await Verification.bulkWrite(ops, { ordered: false });
  const insertedIdx = Object.keys(bw.upsertedIds || {}).map(Number);
  if (!insertedIdx.length) return;

  const inc = { processedEmails: insertedIdx.length };
  let unknown = 0;
  for (const i of insertedIdx) {
    const s = results[i].status;
    inc[`results.${COUNT_FIELD[s] || 'unknown'}`] = (inc[`results.${COUNT_FIELD[s] || 'unknown'}`] || 0) + 1;
    if (s === 'unknown') unknown += 1;
  }
  await BulkJob.updateOne({ jobId }, { $inc: inc, $set: { status: 'processing' } });
  // Users are not charged for addresses we couldn't verify.
  await User.updateOne({ _id: userId }, { $inc: { totalVerified: insertedIdx.length - unknown, credits: unknown } });
  await finalizeIfDone(jobId);
}

async function finalizeIfDone(jobId) {
  const job = await BulkJob.findOne({ jobId }).select('processedEmails totalEmails status').lean();
  if (!job || job.processedEmails < job.totalEmails) return;
  // Conditional on status, so concurrent batches finalize exactly once.
  const r = await BulkJob.updateOne(
    { jobId, status: { $in: ['queued', 'processing'] } },
    { $set: { status: 'completed', completedAt: new Date() } },
  );
  if (r.modifiedCount) logger.info(`[bulk] ${jobId} completed (${job.totalEmails} emails)`);
}

/** Emails of this batch that already have a saved result (for retries). */
async function alreadyDone(jobId, emails) {
  const rows = await Verification.find({ bulkJobId: jobId, email: { $in: emails } }).select('email').lean();
  return new Set(rows.map((r) => r.email));
}

module.exports = { createJob, recordResults, finalizeIfDone, alreadyDone };
