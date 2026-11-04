const dnsPromises = require('dns').promises;
const cache = require('./cache');

const resolver = new dnsPromises.Resolver({ timeout: 5000, tries: 2 });
const NOT_FOUND = new Set(['ENOTFOUND', 'NXDOMAIN']);
const NO_DATA = new Set(['ENODATA', 'ENOTIMP']);

/**
 * Look up where mail for `domain` should go.
 * Returns { state, hosts } where state is:
 *   'ok'          → hosts = MX hosts sorted by priority (or the domain itself via implicit MX)
 *   'nxdomain'    → the domain does not exist                → address is invalid
 *   'no_mail'     → domain exists but publishes a null MX / no MX and no A record → invalid
 *   'error'       → DNS timeout/SERVFAIL — we DON'T know, so the caller must say "unknown"
 */
// Sanity check: a broken or filtering DNS resolver can answer "does not exist"
// for everything. Before we trust a negative answer, make sure the resolver can
// see a domain that certainly exists. Cached for 5 minutes.
let health = { ok: null, at: 0 };
async function resolverHealthy(r) {
  if (health.ok !== null && Date.now() - health.at < 5 * 60 * 1000) return health.ok;
  let ok = false;
  try { ok = (await r.resolveMx('gmail.com')).length > 0; } catch { ok = false; }
  health = { ok, at: Date.now() };
  return ok;
}

async function lookupMail(domain, r = resolver) {
  const key = `mx:${domain}`;
  const cached = await cache.get(key);
  if (cached) return cached;
  const out = await rawLookup(domain, r);
  if ((out.state === 'nxdomain' || out.state === 'no_mail') && !(await resolverHealthy(r))) {
    // Don't cache: this is a problem with our DNS, not with the domain.
    return { state: 'error', hosts: [], error: 'this server\'s DNS resolver is not working' };
  }
  // Cache definitive DNS answers for 1h, failures only briefly.
  await cache.set(key, out, out.state === 'error' ? 60 : 3600);
  return out;
}

async function rawLookup(domain, r) {

  let out;
  try {
    const mx = await r.resolveMx(domain);
    const hosts = mx
      .filter((m) => m.exchange && m.exchange !== '.')
      .sort((a, b) => a.priority - b.priority)
      .map((m) => m.exchange.replace(/\.$/, '').toLowerCase());
    // RFC 7505 "null MX": the domain explicitly accepts no mail.
    out = hosts.length ? { state: 'ok', hosts } : { state: 'no_mail', hosts: [] };
  } catch (err) {
    if (NOT_FOUND.has(err.code)) out = { state: 'nxdomain', hosts: [] };
    else if (NO_DATA.has(err.code)) out = await implicitMx(domain, r);
    else out = { state: 'error', hosts: [], error: err.code || err.message };
  }
  return out;
}

// RFC 5321 §5.1: with no MX record, mail goes to the domain's A/AAAA record.
async function implicitMx(domain, r) {
  for (const fn of ['resolve4', 'resolve6']) {
    try {
      const addrs = await r[fn](domain);
      if (addrs.length) return { state: 'ok', hosts: [domain], implicit: true };
    } catch (err) {
      if (!NO_DATA.has(err.code) && !NOT_FOUND.has(err.code)) return { state: 'error', hosts: [], error: err.code };
    }
  }
  return { state: 'no_mail', hosts: [] };
}

module.exports = { lookupMail, _resetHealth: () => { health = { ok: null, at: 0 }; } };
