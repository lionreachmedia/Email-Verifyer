/** ZeroBounce — free plan includes monthly credits. https://www.zerobounce.net */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

function map(d) {
  const status = String(d.status || '').toLowerCase();
  const sub = String(d.sub_status || '').toLowerCase();
  const raw = short({ status: d.status, sub_status: d.sub_status });
  const extra = { raw, suggestion: d.did_you_mean || null };

  if (sub.includes('quota') || sub === 'mailbox_quota_exceeded') return { ...extra, verdict: 'full', reason: 'mailbox_full', details: 'ZeroBounce: mailbox is full.' };
  switch (status) {
    case 'valid': return { ...extra, verdict: 'deliverable', reason: 'mailbox_exists', catchAll: false, details: 'ZeroBounce confirmed the mailbox exists.' };
    case 'invalid': return { ...extra, verdict: 'undeliverable', reason: sub === 'mailbox_not_found' || !sub ? 'mailbox_not_found' : `zb_${sub}`, details: `ZeroBounce: invalid${sub ? ` (${sub})` : ''}.` };
    case 'catch-all': return { ...extra, verdict: 'catch_all', reason: 'accept_all', catchAll: true, details: 'ZeroBounce: the domain accepts any address.' };
    case 'spamtrap': return { ...extra, verdict: 'risky', reason: 'spamtrap', details: 'ZeroBounce: known spam trap. Do not mail.' };
    case 'abuse': return { ...extra, verdict: 'risky', reason: 'abuse', details: 'ZeroBounce: owner is known to mark mail as spam.' };
    case 'do_not_mail': return { ...extra, verdict: 'risky', reason: sub ? `do_not_mail_${sub}` : 'do_not_mail', details: `ZeroBounce: do not mail${sub ? ` (${sub})` : ''}.` };
    default: return { ...extra, verdict: 'unknown', reason: 'provider_unknown', details: `ZeroBounce could not determine this mailbox${sub ? ` (${sub})` : ''}.` };
  }
}

module.exports = {
  name: 'zerobounce',
  isConfigured: () => Boolean(env.keys.zerobounce),
  missingConfig: 'Set ZEROBOUNCE_API_KEY.',
  async check(email) {
    const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(env.keys.zerobounce)}&email=${encodeURIComponent(email)}&ip_address=`;
    const res = await requestJson(url);
    if (!res.ok) return httpFailure('ZeroBounce', res);
    // ZeroBounce reports bad keys / no credits as HTTP 200 with an "error" field.
    if (res.data && res.data.error) {
      const quota = /credit/i.test(res.data.error);
      return { verdict: 'unknown', reason: quota ? 'provider_quota' : 'provider_auth', providerError: true, cooldownSec: quota ? 3600 : 6 * 3600, details: `ZeroBounce: ${res.data.error}` };
    }
    return map(res.data || {});
  },
  map,
};
