const { env } = require('../../../config/env');

/**
 * fetch() with a timeout that converts HTTP failures into provider results:
 *  - 401/403 → provider_auth   (bad API key)      → provider cooled down for 6h
 *  - 402/429 → provider_quota  (out of credits)   → provider cooled down for 1h
 *  - network/timeout/5xx → provider_error         → try the next provider
 */
async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || env.verify.providerTimeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function httpFailure(name, res) {
  const msg = (res.data && (res.data.message || res.data.error || res.data.errors?.[0]?.details)) || res.error || `HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) return { verdict: 'unknown', reason: 'provider_auth', providerError: true, cooldownSec: 6 * 3600, details: `${name}: API key rejected (${msg}).` };
  if (res.status === 402 || res.status === 429) return { verdict: 'unknown', reason: 'provider_quota', providerError: true, cooldownSec: 3600, details: `${name}: out of credits or rate limited (${msg}).` };
  return { verdict: 'unknown', reason: 'provider_error', providerError: true, details: `${name}: request failed (${msg}).` };
}

const short = (obj) => { try { return JSON.stringify(obj).slice(0, 500); } catch { return null; } };

module.exports = { requestJson, httpFailure, short };
