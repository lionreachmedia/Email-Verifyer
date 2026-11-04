/**
 * Reoon Email Verifier — https://emailverifier.reoon.com
 *
 * Uses the single-verify API in "power" mode, which checks the actual mailbox.
 * ("quick" mode only checks syntax/domain, which MailGuard already does for free,
 * so a "valid" from quick mode is NOT treated as a confirmed mailbox.)
 *
 *   GET https://emailverifier.reoon.com/api/v1/verify?email=…&key=…&mode=power
 */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

// REOON_BASE_URL is only for tests; leave it unset.
const BASE = (process.env.REOON_BASE_URL || 'https://emailverifier.reoon.com/api/v1').replace(/\/+$/, '');

function map(d) {
  const status = String(d.status || '').toLowerCase();
  const raw = short({
    status: d.status, overall_score: d.overall_score, is_safe_to_send: d.is_safe_to_send,
    is_deliverable: d.is_deliverable, is_catch_all: d.is_catch_all, verification_mode: d.verification_mode,
  });
  const extra = { raw, catchAll: typeof d.is_catch_all === 'boolean' ? d.is_catch_all : null };
  const quickMode = String(d.verification_mode || '').toLowerCase() === 'quick';

  switch (status) {
    case 'safe':
      return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Reoon confirmed the mailbox exists and is safe to send to.' };
    case 'valid':
      if (quickMode) return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: 'Reoon quick mode does not check the mailbox. Set REOON_MODE=power.' };
      return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Reoon: the mailbox is deliverable.' };
    case 'role_account':
      if (d.is_deliverable === true) return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Reoon: deliverable role address (info@, sales@…).' };
      if (d.is_deliverable === false) return { ...extra, verdict: 'undeliverable', reason: 'mailbox_not_found', details: 'Reoon: role address that does not accept mail.' };
      return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: 'Reoon: role address; mailbox could not be confirmed.' };
    case 'invalid':
      return { ...extra, verdict: 'undeliverable', reason: 'mailbox_not_found', details: 'Reoon: the mailbox does not exist.' };
    case 'disabled':
      return { ...extra, verdict: 'undeliverable', reason: 'mailbox_disabled', details: 'Reoon: this mailbox has been disabled.' };
    case 'inbox_full':
      return { ...extra, verdict: 'full', reason: 'mailbox_full', details: 'Reoon: the mailbox exists but is full.' };
    case 'catch_all':
      return { ...extra, catchAll: true, verdict: 'catch_all', reason: 'accept_all', details: 'Reoon: the domain accepts any address.' };
    case 'disposable':
      return { ...extra, verdict: 'risky', reason: 'disposable', details: 'Reoon: temporary / disposable inbox.' };
    case 'spamtrap':
      return { ...extra, verdict: 'risky', reason: 'spamtrap', details: 'Reoon: known spam trap. Do not mail.' };
    default:
      return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: `Reoon could not determine this mailbox${status ? ` (${status})` : ''}.` };
  }
}

/** Reoon reports bad keys / no credits as { status: "error", reason: "…" }. */
function apiError(d) {
  const msg = String(d.reason || d.message || d.error || 'unknown error');
  if (/credit|balance|quota|limit/i.test(msg)) {
    return { verdict: 'unknown', reason: 'provider_quota', providerError: true, cooldownSec: 3600, details: `Reoon: ${msg}` };
  }
  if (/key|auth|unauthori[sz]ed|forbidden|inactive|suspend/i.test(msg)) {
    return { verdict: 'unknown', reason: 'provider_auth', providerError: true, cooldownSec: 6 * 3600, details: `Reoon: ${msg}` };
  }
  return { verdict: 'unknown', reason: 'provider_error', providerError: true, details: `Reoon: ${msg}` };
}

module.exports = {
  name: 'reoon',
  isConfigured: () => Boolean(env.keys.reoon),
  missingConfig: 'Set REOON_API_KEY.',
  async check(email) {
    const mode = env.keys.reoonMode === 'quick' ? 'quick' : 'power';
    const url = `${BASE}/verify?email=${encodeURIComponent(email)}&key=${encodeURIComponent(env.keys.reoon)}&mode=${mode}`;
    // Power mode talks to the mail server, so give it more time than other APIs.
    const res = await requestJson(url, { timeoutMs: Math.max(env.verify.providerTimeoutMs, 90000) });
    if (res.data && String(res.data.status).toLowerCase() === 'error') return apiError(res.data);
    if (!res.ok || !res.data || !res.data.status) return httpFailure('Reoon', res);
    return map(res.data);
  },

  /** Remaining credits, shown by `npm run doctor`. */
  async balance() {
    const res = await requestJson(`${BASE}/check-account-balance/?key=${encodeURIComponent(env.keys.reoon)}`, { timeoutMs: 15000 });
    return res;
  },
  map,
  apiError,
};
