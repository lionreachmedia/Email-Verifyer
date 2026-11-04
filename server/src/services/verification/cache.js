/**
 * Tiny JSON cache over Redis with an in-memory fallback.
 * Used for: per-email results, per-domain MX + catch-all, provider cooldowns.
 * A cache failure never breaks verification — it just means a cache miss.
 */
const logger = require('../../utils/logger');

const PREFIX = 'mg:';
const memory = new Map();
let redis = null;

function useRedis(client) { redis = client; }

async function get(key) {
  try {
    if (redis && redis.status === 'ready') {
      const v = await redis.get(PREFIX + key);
      return v ? JSON.parse(v) : null;
    }
  } catch (err) { logger.debug(`cache get failed: ${err.message}`); }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) { memory.delete(key); return null; }
  return hit.value;
}

async function set(key, value, ttlSeconds) {
  try {
    if (redis && redis.status === 'ready') {
      await redis.set(PREFIX + key, JSON.stringify(value), 'EX', Math.max(1, Math.round(ttlSeconds)));
      return;
    }
  } catch (err) { logger.debug(`cache set failed: ${err.message}`); }
  if (memory.size > 50000) memory.clear();
  memory.set(key, { value, exp: Date.now() + ttlSeconds * 1000 });
}

async function del(key) {
  try { if (redis && redis.status === 'ready') await redis.del(PREFIX + key); } catch { /* ignore */ }
  memory.delete(key);
}

module.exports = { get, set, del, useRedis };
