require('./helpers');
const test = require('node:test');
const assert = require('node:assert');
const { parseEmailFile } = require('../src/utils/csv');

test('csv with email header + other columns', async () => {
  const r = await parseEmailFile(Buffer.from('\uFEFFName,Email Address,Company\r\nJo,Jo@A.com,X\r\nAl,al@b.com,Y\r\nJo2,jo@a.com,Z\r\n'));
  assert.deepEqual(r.emails, ['jo@a.com', 'al@b.com']); assert.equal(r.duplicates, 1);
});
test('plain list without header', async () => {
  const r = await parseEmailFile(Buffer.from('a@x.com\nb@y.com\n\n"c@z.com"\n'));
  assert.deepEqual(r.emails, ['a@x.com', 'b@y.com', 'c@z.com']);
});
test('csv with unknown header names', async () => {
  const r = await parseEmailFile(Buffer.from('id;contact\n1;a@x.com\n2;b@y.com\n'));
  assert.deepEqual(r.emails, ['a@x.com', 'b@y.com']);
});
