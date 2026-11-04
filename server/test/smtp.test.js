const { fakeSmtp } = require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const smtp = require('../src/services/verification/providers/smtp');

const ctx = (domain = 'fake.test') => ({ domain, mxHosts: ['127.0.0.1'] });
const run = async (srv, email, domain) => {
  const { server, port } = await fakeSmtp(srv);
  try { return await smtp.check(email, ctx(domain), { port, timeoutMs: 2000 }); } finally { server.close(); }
};

test('existing mailbox + probe rejected → deliverable', async () => {
  const r = await run({ rcpt: { 'real@a.test': '250 2.1.5 OK', '*': '550 5.1.1 The email account that you tried to reach does not exist' } }, 'real@a.test', 'a.test');
  assert.equal(r.verdict, 'deliverable');
  assert.equal(r.catchAll, false);
});

test('missing mailbox → undeliverable', async () => {
  const r = await run({ rcpt: { '*': '550 5.1.1 <nobody@b.test>: Recipient address rejected: User unknown' } }, 'nobody@b.test', 'b.test');
  assert.equal(r.verdict, 'undeliverable');
});

test('server accepts everything → catch-all', async () => {
  const r = await run({ rcpt: { '*': '250 OK' } }, 'any@c.test', 'c.test');
  assert.equal(r.verdict, 'catch_all');
});

test('IP blocked (5.7.1 Spamhaus) → unknown, NOT invalid', async () => {
  const r = await run({ rcpt: { '*': '550 5.7.1 Service unavailable; client host blocked using Spamhaus' } }, 'x@d.test', 'd.test');
  assert.equal(r.verdict, 'unknown');
  assert.equal(r.reason, 'smtp_blocked');
});

test('Office365 DBEB 5.4.1 → undeliverable', async () => {
  const r = await run({ rcpt: { '*': '550 5.4.1 Recipient address rejected: Access denied. AS(201806281)' } }, 'x@e.test', 'e.test');
  assert.equal(r.verdict, 'undeliverable');
});

test('greylisting 451 → unknown', async () => {
  const r = await run({ rcpt: { '*': '451 4.7.1 Greylisted, please try again later' } }, 'x@f.test', 'f.test');
  assert.equal(r.reason, 'greylisted');
});

test('mailbox full 552 → full', async () => {
  const r = await run({ rcpt: { '*': '552 5.2.2 Mailbox full' } }, 'x@g.test', 'g.test');
  assert.equal(r.verdict, 'full');
});

test('MAIL FROM rejected → unknown blocked', async () => {
  const r = await run({ mailFrom: '553 5.7.1 Sender address rejected' }, 'x@h.test', 'h.test');
  assert.equal(r.verdict, 'unknown');
});

test('silent server → timeout unknown', async () => {
  const r = await run({ banner: null }, 'x@i.test', 'i.test');
  assert.equal(r.verdict, 'unknown');
});

test('nothing listening (port 25 blocked) → unknown smtp_unreachable', async () => {
  const r = await smtp.check('x@j.test', { domain: 'j.test', mxHosts: ['127.0.0.1'] }, { port: 1, timeoutMs: 1000 });
  assert.equal(r.reason, 'smtp_unreachable');
});

test('yahoo MX is never trusted at SMTP level', async () => {
  const r = await smtp.check('x@yahoo.com', { domain: 'yahoo.com', mxHosts: ['mta5.am0.yahoodns.net'] });
  assert.equal(r.reason, 'smtp_blind_provider');
});

test('classifyRcpt table', () => {
  assert.equal(smtp.classifyRcpt(550, '550 Requested action not taken: mailbox unavailable'), 'rejected');
  assert.equal(smtp.classifyRcpt(554, '554 5.7.1 Message rejected due to policy'), 'blocked');
  assert.equal(smtp.classifyRcpt(550, '550 5.7.606 Access denied, banned sending IP'), 'blocked');
  assert.equal(smtp.classifyRcpt(421, '421 4.7.0 unusual rate of unsolicited mail'), 'temp');
  assert.equal(smtp.classifyRcpt(252, '252 Cannot VRFY'), 'unverifiable');
});
