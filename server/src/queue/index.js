const { Queue } = require('bullmq');
const { createRedis } = require('../config/redis');

const QUEUE_NAME = 'email-verification';
let queue;

function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createRedis('queue'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 5000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return queue;
}

module.exports = { getQueue, QUEUE_NAME };
