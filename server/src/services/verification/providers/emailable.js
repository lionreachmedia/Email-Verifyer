/** Emailable — free credits on signup. https://emailable.com */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

function map(d) {
  const raw = short({ state: d.state, reason: d.reason, accept_all: d.accept_all });
  const extra = { raw, suggestion: d.did_you_mean || null, catchAll: typeof d.accept_all === 'boolean' ? d.accept_all : null };
  if (d.accept_all && d.state !== 'undeliverable') return { ...extra, verdict: 'catch_all', reason: 'accept_all', details: 'Emailable: the domain accepts any address.' };
  switch (d.state) {
    case 'deliverable': return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Emailable confirmed the mailbox exists.' };
    case 'undeliverable': return { ...extra, verdict: 'undeliverable', reason: d.reason === 'rejected_email' ? 'mailbox_not_found' : `emailable_${d.reason || 'undeliverable'}`, details: `Emailable: undeliverable (${d.reason}).` };
    case 'risky': return { ...extra, verdict: 'risky', reason: `emailable_${d.reason || 'risky'}`, details: `Emailable: risky (${d.reason}).` };
    default: return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: `Emailable could not determine this mailbox (${d.reason || 'unknown'}).` };
  }
}

module.exports = {
  name: 'emailable',
  isConfigured: () => Boolean(env.keys.emailable),
  missingConfig: 'Set EMAILABLE_API_KEY.',
  async check(email) {
    const url = `https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(env.keys.emailable)}`;
    const res = await requestJson(url);
    if (res.status === 249) return { verdict: 'unknown', reason: 'provider_pending', providerError: true, details: 'Emailable is still processing this address.' };
    if (!res.ok || !res.data || !res.data.state) return httpFailure('Emailable', res);
    return map(res.data);
  },
  map,
};
