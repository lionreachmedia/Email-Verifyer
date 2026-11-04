/**
 * Verification pipeline.
 *
 *   1. Local checks       syntax, disposable (120k+ domains), role, free provider, typo
 *   2. DNS                does the domain exist and accept mail (MX / implicit MX / null MX)?
 *   3. Result cache       same address checked recently → reuse, no credits spent on providers
 *   4. Mailbox check      API providers from VERIFY_PROVIDERS, in order. The first
 *                         definite answer wins; "unknown", errors and "out of
 *                         credits" fall through to the next provider.
 *
 * Golden rule: we only say "invalid" with proof (bad syntax, no such domain,
 * no mail server, or a mail server/provider that rejected the mailbox).
 * Anything we couldn't prove is "unknown", with the reason attached.
 */
const { env } = require('../../config/env');
const logger = require('../../utils/logger');
const { normalize } = require('../../utils/email');
const cache = require('./cache');
const local = require('./local');
const { lookupMail } = require('./dns');
const PROVIDERS = require('./providers');

const DEFINITIVE = new Set(['deliverable', 'undeliverable', 'catch_all', 'full', 'risky']);

function activeProviders(names = env.verify.providers) {
  return names
    .map((n) => PROVIDERS[n])
    .filter((p) => p && p.isConfigured());
}

function providersStatus() {
  return env.verify.providers.map((name) => {
    const p = PROVIDERS[name];
    if (!p) return { name, configured: false, note: 'Unknown provider name' };
    return { name, configured: p.isConfigured(), note: p.isConfigured() ? null : p.missingConfig };
  });
}

function confidenceFor(status, reason, flags) {
  switch (status) {
    case 'valid': return flags.roleBased ? 85 : flags.catchAll === null ? 90 : 97;
    case 'invalid': return 0;
    case 'catch-all': return 50;
    case 'risky':
      if (reason === 'mailbox_full') return 30;
      if (reason === 'disposable') return 15;
      if (/spamtrap|abuse/.test(reason)) return 5;
      return 40;
    default: return null; // unknown: we genuinely don't know
  }
}

function build(email, la, fields, startedAt) {
  const status = fields.status;
  const out = {
    email,
    status,
    reason: fields.reason,
    details: fields.details || '',
    syntaxValid: la.syntaxValid,
    domainExists: 'domainExists' in fields ? fields.domainExists : false,
    mxFound: 'mxFound' in fields ? fields.mxFound : false,
    mxRecord: fields.mxRecord ?? null,
    mailbox: fields.mailbox || 'skipped',
    catchAll: fields.catchAll ?? null,
    disposable: la.disposable,
    roleBased: la.roleBased,
    freeProvider: la.freeProvider,
    suggestion: fields.suggestion || la.suggestion || null,
    provider: fields.provider || 'local',
    providerResponse: fields.providerResponse || null,
    cached: false,
    durationMs: Date.now() - startedAt,
  };
  out.confidence = confidenceFor(status, out.reason, out);
  return out;
}

function fromVerdict(r) {
  switch (r.verdict) {
    case 'deliverable': return { status: 'valid', mailbox: 'deliverable' };
    case 'undeliverable': return { status: 'invalid', mailbox: 'undeliverable' };
    case 'catch_all': return { status: 'catch-all', mailbox: 'unknown', catchAll: true };
    case 'full': return { status: 'risky', mailbox: 'full' };
    case 'risky': return { status: 'risky', mailbox: 'unknown' };
    default: return { status: 'unknown', mailbox: 'unknown' };
  }
}

async function verifyEmail(rawEmail, opts = {}) {
  const startedAt = Date.now();
  const email = normalize(rawEmail);
  const la = local.analyze(email);

  // 1. Syntax
  if (!la.syntaxValid) {
    return build(email, la, { status: 'invalid', reason: 'invalid_syntax', details: 'This is not a valid email address format.' }, startedAt);
  }

  // 2. Cache
  const cacheKey = `result:${email}`;
  if (!opts.skipCache) {
    const hit = await cache.get(cacheKey);
    if (hit) return { ...hit, cached: true, durationMs: Date.now() - startedAt };
  }

  // 3. DNS
  const mail = await (opts.lookupMail || lookupMail)(la.domain);
  if (mail.state === 'nxdomain') {
    return build(email, la, { status: 'invalid', reason: 'domain_not_found', details: `The domain ${la.domain} does not exist.` }, startedAt);
  }
  if (mail.state === 'no_mail') {
    return build(email, la, { status: 'invalid', reason: 'no_mail_server', domainExists: true, details: `${la.domain} exists but is not set up to receive email.` }, startedAt);
  }
  if (mail.state === 'error') {
    return build(email, la, { status: 'unknown', reason: 'dns_error', domainExists: null, mxFound: null, details: `DNS lookup for ${la.domain} failed temporarily (${mail.error}). Try again later.` }, startedAt);
  }
  const dnsFields = { domainExists: true, mxFound: true, mxRecord: mail.hosts[0] };

  // 4. Disposable: no need to spend provider credits on throwaway inboxes.
  if (la.disposable) {
    const res = build(email, la, { ...dnsFields, status: 'risky', reason: 'disposable', details: 'This is a temporary/disposable inbox. It may work today but is gone soon.' }, startedAt);
    await cache.set(cacheKey, res, env.verify.cacheTtlHours * 3600);
    return res;
  }

  // 5. Mailbox providers
  const chain = opts.providers || activeProviders();
  if (!chain.length) {
    return build(email, la, {
      ...dnsFields, status: 'unknown', reason: 'no_provider',
      details: 'Domain accepts mail, but no mailbox-check API is configured. Set VERIFY_PROVIDERS and an API key in server/.env.',
    }, startedAt);
  }

  const attempts = [];
  for (const provider of chain) {
    if (await cache.get(`cooldown:${provider.name}`)) {
      attempts.push({ provider: provider.name, reason: 'cooling_down', details: `${provider.name} skipped (recent quota/auth error).` });
      continue;
    }
    let r;
    try {
      r = await provider.check(email, { domain: la.domain, mxHosts: mail.hosts });
    } catch (err) {
      logger.error(`[verify] provider ${provider.name} crashed on ${email}: ${err.message}`);
      r = { verdict: 'unknown', reason: 'provider_error', providerError: true, details: `${provider.name} failed: ${err.message}` };
    }
    if (r.cooldownSec) {
      await cache.set(`cooldown:${provider.name}`, true, r.cooldownSec);
      logger.warn(`[verify] ${provider.name} paused for ${r.cooldownSec}s: ${r.details}`);
    }
    attempts.push({ provider: provider.name, ...r });

    if (DEFINITIVE.has(r.verdict)) {
      const res = build(email, la, {
        ...dnsFields,
        ...fromVerdict(r),
        catchAll: r.verdict === 'catch_all' ? true : r.catchAll ?? null,
        reason: r.reason,
        details: r.details,
        suggestion: r.suggestion,
        provider: provider.name,
        providerResponse: r.raw || null,
      }, startedAt);
      await cache.set(cacheKey, res, env.verify.cacheTtlHours * 3600);
      return res;
    }
  }

  // Nobody could give a definitive answer. Say so honestly.
  const last = attempts[attempts.length - 1];
  return build(email, la, {
    ...dnsFields,
    status: 'unknown',
    mailbox: 'unknown',
    reason: last.reason,
    details: attempts.map((a) => a.details).filter(Boolean).join(' '),
    provider: last.provider,
    providerResponse: last.raw || null,
  }, startedAt);
}

module.exports = { verifyEmail, providersStatus, activeProviders };
