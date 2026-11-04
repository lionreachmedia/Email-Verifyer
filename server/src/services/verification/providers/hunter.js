/** Hunter — free plan includes monthly verifications. https://hunter.io */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

function map(d) {
  const raw = short({ status: d.status, result: d.result, score: d.score, accept_all: d.accept_all });
  const extra = { raw, catchAll: typeof d.accept_all === 'boolean' ? d.accept_all : null };
  switch (d.status) {
    case 'valid': return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Hunter confirmed the mailbox exists.' };
    case 'invalid': return { ...extra, verdict: 'undeliverable', reason: 'mailbox_not_found', details: 'Hunter: the mailbox does not exist.' };
    case 'accept_all': return { ...extra, verdict: 'catch_all', reason: 'accept_all', catchAll: true, details: 'Hunter: the domain accepts any address.' };
    case 'webmail':
      if (d.result === 'deliverable') return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Hunter: deliverable webmail address.' };
      if (d.result === 'undeliverable') return { ...extra, verdict: 'undeliverable', reason: 'mailbox_not_found', details: 'Hunter: undeliverable webmail address.' };
      return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: 'Hunter could not confirm this webmail mailbox.' };
    case 'disposable': return { ...extra, verdict: 'risky', reason: 'disposable', details: 'Hunter: disposable address.' };
    default: return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: 'Hunter could not determine this mailbox.' };
  }
}

module.exports = {
  name: 'hunter',
  isConfigured: () => Boolean(env.keys.hunter),
  missingConfig: 'Set HUNTER_API_KEY.',
  async check(email) {
    const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(env.keys.hunter)}`;
    const res = await requestJson(url);
    if (res.status === 202) return { verdict: 'unknown', reason: 'provider_pending', providerError: true, details: 'Hunter is still processing this address.' };
    if (!res.ok || !res.data || !res.data.data) return httpFailure('Hunter', res);
    return map(res.data.data);
  },
  map,
};
