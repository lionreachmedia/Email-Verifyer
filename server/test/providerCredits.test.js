const http = require('http');
const test = require('node:test');
const assert = require('node:assert');

let balanceReply = [200, { status: 'success', api_status: 'active', remaining_daily_credits: 20, remaining_instant_credits: 100 }];
let calls = 0;
const server = http.createServer((req, res) => {
  calls += 1;
  res.writeHead(balanceReply[0], { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(balanceReply[1]));
});

let svc;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  Object.assign(process.env, {
    REOON_BASE_URL: `http://127.0.0.1:${server.address().port}`, REOON_API_KEY: 'k', VERIFY_PROVIDERS: 'reoon',
    JWT_SECRET: 'test_secret_that_is_definitely_longer_than_32_chars', LOG_LEVEL: 'error',
  });
  for (const k of Object.keys(require.cache)) if (k.includes('/src/')) delete require.cache[k];
  svc = require('../src/services/providerCredits');
});
test.after(() => server.close());

test('reads instant + daily credits and totals them', async () => {
  const r = await svc.getProviderCredits({ fresh: true });
  assert.equal(r.ok, true); assert.equal(r.instant, 100); assert.equal(r.daily, 20); assert.equal(r.total, 120);
});

test('second call within 30 s is served from cache', async () => {
  const before = calls;
  await svc.getProviderCredits();
  assert.equal(calls, before);
});

test('fresh=true bypasses the cache', async () => {
  balanceReply = [200, { status: 'success', remaining_daily_credits: 20, remaining_instant_credits: 99 }];
  const r = await svc.getProviderCredits({ fresh: true });
  assert.equal(r.instant, 99); assert.equal(r.total, 119);
});

test('Reoon error is reported, not hidden', async () => {
  balanceReply = [200, { status: 'error', reason: 'Invalid API key.' }];
  const r = await svc.getProviderCredits({ fresh: true });
  assert.equal(r.ok, false); assert.match(r.error, /Invalid API key/);
});
