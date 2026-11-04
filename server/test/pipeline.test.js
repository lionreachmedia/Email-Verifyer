require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const { verifyEmail } = require('../src/services/verification');

const okDns = async () => ({ state: 'ok', hosts: ['mx.fake.test'] });
const stub = (name, r) => ({ name, isConfigured: () => true, check: async () => r });
let n = 0;
const uniq = (d = 'acme.test') => `user${++n}@${d}`;

test('bad syntax → invalid, no network', async () => {
  const r = await verifyEmail('not-an-email', { lookupMail: () => { throw new Error('should not call'); } });
  assert.equal(r.status, 'invalid'); assert.equal(r.reason, 'invalid_syntax');
});

test('nonexistent domain → invalid', async () => {
  const r = await verifyEmail(uniq(), { lookupMail: async () => ({ state: 'nxdomain', hosts: [] }) });
  assert.equal(r.reason, 'domain_not_found');
});

test('DNS timeout → unknown (never invalid)', async () => {
  const r = await verifyEmail(uniq(), { lookupMail: async () => ({ state: 'error', hosts: [], error: 'ETIMEOUT' }) });
  assert.equal(r.status, 'unknown');
});

test('disposable → risky, providers not called', async () => {
  const r = await verifyEmail('a@mailinator.com', { lookupMail: okDns, providers: [stub('x', { verdict: 'undeliverable' })], skipCache: true });
  assert.equal(r.status, 'risky'); assert.equal(r.reason, 'disposable');
});

test('falls through unknown provider to the next one', async () => {
  const r = await verifyEmail(uniq(), {
    lookupMail: okDns,
    providers: [stub('zerobounce', { verdict: 'unknown', reason: 'provider_quota', details: 'out of credits.' }), stub('emailable', { verdict: 'deliverable', reason: 'mailbox_exists' })],
  });
  assert.equal(r.status, 'valid'); assert.equal(r.provider, 'emailable'); assert.ok(r.confidence >= 85);
});

test('all providers unknown → unknown with reasons', async () => {
  const r = await verifyEmail(uniq(), { lookupMail: okDns, providers: [stub('zerobounce', { verdict: 'unknown', reason: 'provider_unknown', details: 'could not determine.' })] });
  assert.equal(r.status, 'unknown'); assert.equal(r.reason, 'provider_unknown'); assert.equal(r.confidence, null);
});

test('no providers configured → unknown no_provider', async () => {
  const r = await verifyEmail(uniq(), { lookupMail: okDns, providers: [] });
  assert.equal(r.reason, 'no_provider');
});

test('quota error puts provider in cooldown and is skipped next time', async () => {
  let calls = 0;
  const p = { name: 'quotaprov', isConfigured: () => true, check: async () => { calls += 1; return { verdict: 'unknown', reason: 'provider_quota', cooldownSec: 60 }; } };
  await verifyEmail(uniq(), { lookupMail: okDns, providers: [p] });
  await verifyEmail(uniq(), { lookupMail: okDns, providers: [p] });
  assert.equal(calls, 1);
});

test('definitive results are cached', async () => {
  let calls = 0;
  const p = { name: 'counting', isConfigured: () => true, check: async () => { calls += 1; return { verdict: 'undeliverable', reason: 'mailbox_not_found' }; } };
  const e = uniq();
  await verifyEmail(e, { lookupMail: okDns, providers: [p] });
  const second = await verifyEmail(e, { lookupMail: okDns, providers: [p] });
  assert.equal(calls, 1); assert.equal(second.cached, true); assert.equal(second.status, 'invalid');
});

test('typo suggestion', async () => {
  const r = await verifyEmail('john@gmial.com', { lookupMail: async () => ({ state: 'nxdomain', hosts: [] }) });
  assert.equal(r.suggestion, 'john@gmail.com');
});

test('gmail dots are preserved (no normalizeEmail rewriting)', async () => {
  const r = await verifyEmail('  John.Doe+news@Gmail.com ', { lookupMail: async () => ({ state: 'nxdomain', hosts: [] }) });
  assert.equal(r.email, 'john.doe+news@gmail.com');
});

test('broken DNS resolver never produces "invalid"', async () => {
  const { lookupMail, _resetHealth } = require('../src/services/verification/dns');
  _resetHealth();
  const nx = Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
  const broken = { resolveMx: async () => { throw nx; }, resolve4: async () => { throw nx; }, resolve6: async () => { throw nx; } };
  const r = await lookupMail('some-real-company.test', broken);
  assert.equal(r.state, 'error');
  _resetHealth();
  const healthy = { resolveMx: async (d) => { if (d === 'gmail.com') return [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }]; throw nx; } };
  const r2 = await lookupMail('typo-domain-xyz.test', healthy);
  assert.equal(r2.state, 'nxdomain');
});

test('DNS failure reports domain/MX as unknown, not "No"', async () => {
  const r = await verifyEmail(uniq(), { lookupMail: async () => ({ state: 'error', hosts: [], error: 'ETIMEOUT' }) });
  assert.equal(r.domainExists, null); assert.equal(r.mxFound, null);
});
