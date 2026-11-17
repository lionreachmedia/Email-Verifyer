/**
 * Live balance of the mailbox-check provider account (currently Reoon).
 * Cached for 30 s so dashboards refreshing every minute don't hammer the API;
 * pass fresh=true right after a verification to get the new balance.
 */
const reoon = require('./verification/providers/reoon');
const cache = require('./verification/cache');
const { env } = require('../config/env');

const KEY = 'balance:reoon';
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

async function getProviderCredits({ fresh = false } = {}) {
  if (!env.verify.providers.includes('reoon') || !reoon.isConfigured()) {
    return { provider: null, configured: false };
  }
  if (!fresh) {
    const hit = await cache.get(KEY);
    if (hit) return hit;
  }

  const res = await reoon.balance();
  const d = res.data || {};
  if (!res.ok || String(d.status).toLowerCase() === 'error') {
    // Not cached: show the error now, retry on the next request.
    return {
      provider: 'reoon', configured: true, ok: false,
      error: d.reason || d.message || res.error || `HTTP ${res.status}`,
    };
  }

  const instant = toNum(d.remaining_instant_credits);
  const daily = toNum(d.remaining_daily_credits);
  const out = {
    provider: 'reoon',
    configured: true,
    ok: true,
    instant,
    daily,
    total: (instant || 0) + (daily || 0),
    apiStatus: d.api_status || null,
    checkedAt: new Date().toISOString(),
  };
  await cache.set(KEY, out, 30);
  return out;
}

module.exports = { getProviderCredits };
