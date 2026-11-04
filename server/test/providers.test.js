require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/services/verification/providers');

test('reacher mapping', () => {
  assert.equal(P.reacher.map({ is_reachable: 'safe', smtp: { is_deliverable: true, is_catch_all: false } }).verdict, 'deliverable');
  assert.equal(P.reacher.map({ is_reachable: 'invalid', smtp: { is_deliverable: false } }).verdict, 'undeliverable');
  assert.equal(P.reacher.map({ is_reachable: 'risky', smtp: { is_catch_all: true } }).verdict, 'catch_all');
  assert.equal(P.reacher.map({ is_reachable: 'unknown', smtp: { type: 'SmtpError', message: 'x' } }).verdict, 'unknown');
});
test('zerobounce mapping', () => {
  assert.equal(P.zerobounce.map({ status: 'valid' }).verdict, 'deliverable');
  assert.equal(P.zerobounce.map({ status: 'invalid', sub_status: 'mailbox_not_found' }).verdict, 'undeliverable');
  assert.equal(P.zerobounce.map({ status: 'catch-all' }).verdict, 'catch_all');
  assert.equal(P.zerobounce.map({ status: 'unknown', sub_status: 'greylisted' }).verdict, 'unknown');
  assert.equal(P.zerobounce.map({ status: 'spamtrap' }).verdict, 'risky');
});
test('emailable / kickbox / hunter mapping', () => {
  assert.equal(P.emailable.map({ state: 'deliverable', accept_all: false }).verdict, 'deliverable');
  assert.equal(P.emailable.map({ state: 'risky', accept_all: true }).verdict, 'catch_all');
  assert.equal(P.kickbox.map({ result: 'undeliverable', reason: 'rejected_email' }).reason, 'mailbox_not_found');
  assert.equal(P.hunter.map({ status: 'accept_all' }).verdict, 'catch_all');
  assert.equal(P.hunter.map({ status: 'webmail', result: 'deliverable' }).verdict, 'deliverable');
});

test('only API providers are registered', () => {
  assert.deepEqual(Object.keys(P).sort(), ['emailable', 'hunter', 'kickbox', 'reacher', 'reoon', 'zerobounce']);
});

test('provider HTTP failures become "unknown", never "invalid"', async () => {
  const { httpFailure } = require('../src/services/verification/providers/http');
  assert.equal(httpFailure('X', { status: 401, data: {} }).reason, 'provider_auth');
  assert.equal(httpFailure('X', { status: 429, data: {} }).reason, 'provider_quota');
  assert.equal(httpFailure('X', { status: 0, error: 'timeout' }).verdict, 'unknown');
});
