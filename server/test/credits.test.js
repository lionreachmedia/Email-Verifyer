const test = require('node:test');
const assert = require('node:assert');
const { isSignupAllowed } = require('../src/utils/signup');

test('signup allowlist: empty list allows everyone', () => {
  assert.equal(isSignupAllowed('anyone@x.com', []), true);
});
test('signup allowlist: domains and exact emails', () => {
  const allowed = ['lionreach.com', 'webteamlionreach@gmail.com'];
  assert.equal(isSignupAllowed('Ashish@LionReach.com', allowed), true);
  assert.equal(isSignupAllowed('webteamlionreach@gmail.com', allowed), true);
  assert.equal(isSignupAllowed('stranger@gmail.com', allowed), false);
  assert.equal(isSignupAllowed('x@notlionreach.com', allowed), false);
  assert.equal(isSignupAllowed('x@sub.lionreach.com', allowed), false);
});

test('USER_CREDITS_ENABLED=false makes charge/refund no-ops (no DB call, no 402)', async () => {
  process.env.USER_CREDITS_ENABLED = 'false';
  process.env.JWT_SECRET ||= 'test_secret_that_is_definitely_longer_than_32_chars';
  for (const k of Object.keys(require.cache)) if (k.includes('/src/')) delete require.cache[k];
  const credits = require('../src/services/credits');
  assert.equal(credits.enabled(), false);
  // Would throw/hang if it touched the (unconnected) database.
  await credits.charge('000000000000000000000000', 1000000);
  await credits.refund('000000000000000000000000', 5);
  delete process.env.USER_CREDITS_ENABLED;
});
