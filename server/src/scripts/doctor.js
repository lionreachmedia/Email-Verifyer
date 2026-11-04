/**
 * npm run doctor                       → checks your setup
 * npm run doctor -- you@company.com   → also verifies one address end-to-end (uses provider credits)
 */
const { env } = require('../config/env');
const PROVIDERS = require('../services/verification/providers');

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✘\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);


async function main() {
  let failures = 0;
  head('Core settings');
  if (env.jwtSecret && env.jwtSecret.length >= 32) ok('JWT_SECRET set'); else { bad('JWT_SECRET missing or shorter than 32 chars'); failures += 1; }
  ok(`CLIENT_URL = ${env.clientUrl}`);

  head('MongoDB');
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    ok(`connected (${mongoose.connection.host}/${mongoose.connection.name})`);
    await mongoose.disconnect();
  } catch (e) { bad(`cannot connect to ${env.mongoUri}: ${e.message}`); failures += 1; }

  head('Redis');
  try {
    const IORedis = require('ioredis');
    const r = new IORedis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000, retryStrategy: () => null });
    r.on('error', () => {});
    await r.connect(); await r.ping();
    const hb = await r.get('mg:worker:heartbeat');
    ok('connected');
    if (hb) ok('worker is running'); else warn('worker is NOT running — bulk jobs will wait. Start it with "npm run worker".');
    r.disconnect();
  } catch (e) { bad(`cannot connect to ${env.redisUrl}: ${e.message}`); failures += 1; }

  head('Outgoing email (sign-up codes, password reset)');
  if (!env.mail.host) warn('MAIL_* not set — codes will be printed in the server console (dev only).');
  else {
    try { await require('../utils/mailer').verifyTransport(); ok(`SMTP login to ${env.mail.host}:${env.mail.port} works`); } catch (e) { bad(`SMTP login failed: ${e.message}`); failures += 1; }
  }

  head('Mailbox-check APIs (VERIFY_PROVIDERS, tried in this order)');
  if (!env.verify.providers.length) warn('VERIFY_PROVIDERS is empty.');
  for (const name of env.verify.providers) {
    const p = PROVIDERS[name];
    if (!p) { bad(`"${name}" is not a known provider (use: ${Object.keys(PROVIDERS).join(', ')})`); failures += 1; continue; }
    if (!p.isConfigured()) { warn(`${name}: not configured — ${p.missingConfig}`); continue; }
    ok(`${name}: configured`);
    if (p.balance) {
      const res = await p.balance();
      const d = res.data || {};
      if (res.ok && String(d.status).toLowerCase() !== 'error') {
        const parts = Object.entries(d).filter(([k]) => /credit|status/i.test(k)).map(([k, v]) => `${k}=${v}`);
        ok(`${name}: API key accepted${parts.length ? ` (${parts.join(', ')})` : ''}`);
      } else {
        bad(`${name}: balance check failed — ${d.reason || d.message || res.error || `HTTP ${res.status}`}`); failures += 1;
      }
    }
  }
  if (!env.verify.providers.some((n) => PROVIDERS[n]?.isConfigured())) {
    bad('No API configured: set VERIFY_PROVIDERS=zerobounce (or another) plus its API key. Until then real addresses come back "unknown".'); failures += 1;
  }

  const testEmail = process.argv[2];
  if (testEmail) {
    head(`Live check: ${testEmail}`);
    const { verifyEmail } = require('../services/verification');
    const r = await verifyEmail(testEmail, { skipCache: true });
    console.log(JSON.stringify(r, null, 2));
  }

  console.log(failures ? `\n\x1b[31m${failures} problem(s) found.\x1b[0m` : '\n\x1b[32mAll good.\x1b[0m');
  process.exit(failures ? 1 : 0);
}

main();
