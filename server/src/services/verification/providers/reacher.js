/**
 * Reacher (https://reacher.email) — hosted email verification API.
 * Set REACHER_API_KEY. (REACHER_URL is only for a self-hosted Reacher backend.)
 */
const { env } = require('../../../config/env');
const { requestJson, httpFailure, short } = require('./http');

function map(d) {
  const smtp = d.smtp && typeof d.smtp === 'object' && !d.smtp.type ? d.smtp : {};
  const misc = d.misc || {};
  const raw = short({ is_reachable: d.is_reachable, smtp, misc: { is_disposable: misc.is_disposable, is_role_account: misc.is_role_account } });
  const base = { raw, catchAll: typeof smtp.is_catch_all === 'boolean' ? smtp.is_catch_all : null };

  if (smtp.is_catch_all) return { ...base, verdict: 'catch_all', reason: 'accept_all', details: 'Reacher: the domain accepts any address.' };
  if (smtp.has_full_inbox) return { ...base, verdict: 'full', reason: 'mailbox_full', details: 'Reacher: mailbox exists but is full.' };

  switch (d.is_reachable) {
    case 'safe':
      return { ...base, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Reacher confirmed the mailbox exists.' };
    case 'invalid':
      if (smtp.is_disabled) return { ...base, verdict: 'undeliverable', reason: 'mailbox_disabled', details: 'Reacher: this mailbox has been disabled.' };
      return { ...base, verdict: 'undeliverable', reason: 'mailbox_not_found', details: 'Reacher: the mailbox does not exist.' };
    case 'risky':
      if (smtp.is_deliverable) return { ...base, verdict: 'deliverable', reason: 'mailbox_exists', details: 'Reacher: deliverable, but flagged risky (role or disposable address).' };
      return { ...base, verdict: 'risky', reason: 'provider_risky', details: 'Reacher flagged this address as risky.' };
    default:
      return { ...base, verdict: 'unknown', reason: 'provider_unknown', details: 'Reacher could not determine this mailbox.' };
  }
}

module.exports = {
  name: 'reacher',
  isConfigured: () => Boolean(env.keys.reacherUrl || env.keys.reacherApiKey),
  missingConfig: 'Set REACHER_URL (self-hosted) or REACHER_API_KEY (hosted).',
  async check(email) {
    const base = env.keys.reacherUrl || 'https://api.reacher.email';
    const headers = {};
    if (env.keys.reacherSecret) headers['x-reacher-secret'] = env.keys.reacherSecret;
    if (env.keys.reacherApiKey) headers.Authorization = env.keys.reacherApiKey;
    const res = await requestJson(`${base}/v0/check_email`, { method: 'POST', headers, body: { to_email: email }, timeoutMs: Math.max(env.verify.providerTimeoutMs, 60000) });
    if (!res.ok || !res.data || !res.data.is_reachable) return httpFailure('Reacher', res);
    return map(res.data);
  },
  map,
};
