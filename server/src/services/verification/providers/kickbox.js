/** Kickbox — free verifications on signup. https://kickbox.com */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

function map(d) {
  const raw = short({ result: d.result, reason: d.reason, accept_all: d.accept_all });
  const extra = { raw, suggestion: d.did_you_mean || null, catchAll: typeof d.accept_all === 'boolean' ? d.accept_all : null };
  if (d.accept_all && d.result !== 'undeliverable') return { ...extra, verdict: 'catch_all', reason: 'accept_all', details: 'Kickbox: the domain accepts any address.' };
  switch (d.result) {
    case 'deliverable': return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Kickbox confirmed the mailbox exists.' };
    case 'undeliverable': return { ...extra, verdict: 'undeliverable', reason: d.reason === 'rejected_email' ? 'mailbox_not_found' : `kickbox_${d.reason || 'undeliverable'}`, details: `Kickbox: undeliverable (${d.reason}).` };
    case 'risky': return { ...extra, verdict: 'risky', reason: `kickbox_${d.reason || 'risky'}`, details: `Kickbox: risky (${d.reason}).` };
    default: return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: `Kickbox could not determine this mailbox (${d.reason || 'unknown'}).` };
  }
}

module.exports = {
  name: 'kickbox',
  isConfigured: () => Boolean(env.keys.kickbox),
  missingConfig: 'Set KICKBOX_API_KEY.',
  async check(email) {
    const url = `https://api.kickbox.com/v2/verify?email=${encodeURIComponent(email)}&apikey=${encodeURIComponent(env.keys.kickbox)}`;
    const res = await requestJson(url);
    if (!res.ok || !res.data || res.data.success === false) return httpFailure('Kickbox', res.ok ? { ...res, status: 402 } : res);
    return map(res.data);
  },
  map,
};
