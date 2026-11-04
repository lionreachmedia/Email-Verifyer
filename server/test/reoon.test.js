const http = require('http');
const test = require('node:test');
const assert = require('node:assert');

// Fake Reoon API: replies depend on the email being checked.
const replies = {
  'ok@x.test': [200, { status: 'safe', is_deliverable: true, is_catch_all: false, verification_mode: 'power' }],
  'gone@x.test': [200, { status: 'invalid', is_deliverable: false, verification_mode: 'power' }],
  'nocredit@x.test': [200, { status: 'error', reason: 'You do not have enough credits.' }],
  'badkey@x.test': [200, { status: 'error', reason: 'Invalid API key.' }],
  'down@x.test': [500, { message: 'internal' }],
};
let lastQuery;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  lastQuery = Object.fromEntries(u.searchParams);
  if (u.pathname.startsWith('/check-account-balance')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'success', api_status: 'active', remaining_daily_credits: 0, remaining_instant_credits: 480 }));
  }
  const [code, body] = replies[u.searchParams.get('email')] || [200, { status: 'unknown' }];
  res.writeHead(code, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(body));
});

let reoon;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.REOON_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.REOON_API_KEY = 'test-key';
  process.env.JWT_SECRET ||= 'test_secret_that_is_definitely_longer_than_32_chars';
  for (const k of Object.keys(require.cache)) if (k.includes('/src/')) delete require.cache[k];
  reoon = require('../src/services/verification/providers/reoon');
});
test.after(() => server.close());

test('sends key, email and power mode', async () => {
  await reoon.check('ok@x.test');
  assert.equal(lastQuery.key, 'test-key');
  assert.equal(lastQuery.mode, 'power');
  assert.equal(lastQuery.email, 'ok@x.test');
});
test('safe → deliverable', async () => assert.equal((await reoon.check('ok@x.test')).verdict, 'deliverable'));
test('invalid → undeliverable', async () => assert.equal((await reoon.check('gone@x.test')).verdict, 'undeliverable'));
test('no credits → unknown + 1h cooldown', async () => {
  const r = await reoon.check('nocredit@x.test');
  assert.equal(r.reason, 'provider_quota'); assert.equal(r.cooldownSec, 3600);
});
test('bad key → unknown provider_auth', async () => assert.equal((await reoon.check('badkey@x.test')).reason, 'provider_auth'));
test('server error → unknown, never invalid', async () => assert.equal((await reoon.check('down@x.test')).verdict, 'unknown'));
test('balance endpoint works', async () => assert.equal((await reoon.balance()).data.remaining_instant_credits, 480));

test('status mapping table', () => {
  const m = (d) => reoon.map(d).verdict;
  assert.equal(m({ status: 'catch_all' }), 'catch_all');
  assert.equal(m({ status: 'inbox_full' }), 'full');
  assert.equal(m({ status: 'disabled' }), 'undeliverable');
  assert.equal(m({ status: 'disposable' }), 'risky');
  assert.equal(m({ status: 'spamtrap' }), 'risky');
  assert.equal(m({ status: 'role_account', is_deliverable: true }), 'deliverable');
  assert.equal(m({ status: 'role_account' }), 'unknown');
  assert.equal(m({ status: 'valid', verification_mode: 'quick' }), 'unknown');
  assert.equal(m({ status: 'something_new' }), 'unknown');
});
