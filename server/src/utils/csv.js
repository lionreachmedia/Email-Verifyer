const csv = require('csv-parser');
const { Readable } = require('stream');
const { normalize } = require('./email');

const EMAIL_COLUMNS = ['email', 'email_address', 'emailaddress', 'e_mail', 'emails', 'mail', 'email_id', 'user_email', 'work_email', 'address'];
const HEADER_WORDS = new Set(['email', 'e-mail', 'mail', 'address', 'emails', 'email_address', 'emailaddress', 'e_mail']);
const looksLikeEmail = (s) => /^[^\s@,;"']+@[^\s@,;"']+\.[^\s@,;"']+$/.test(s);
const clean = (raw) => normalize(String(raw || '').replace(/^["'\s<]+|["'\s>]+$/g, ''));

function fromPlainText(text) {
  const out = [];
  for (const line of text.split('\n')) {
    for (const cell of line.split(/[,;\t]/)) {
      const e = clean(cell);
      if (!HEADER_WORDS.has(e) && looksLikeEmail(e)) out.push(e);
    }
  }
  return out;
}

/**
 * Extract unique emails from an uploaded CSV/TXT buffer.
 * - CSV with a recognised header (email, email_address, …) → that column.
 * - Anything else (no header, plain list, odd columns) → every cell that looks like an email.
 */
function parseEmailFile(buffer) {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  return new Promise((resolve) => {
    const found = [];
    let headerHasEmail = false;
    const finish = (list) => {
      const unique = [...new Set(list)];
      resolve({ emails: unique, duplicates: list.length - unique.length });
    };

    Readable.from([text])
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        strict: false,
      }))
      .on('headers', (headers) => { headerHasEmail = headers.some((h) => EMAIL_COLUMNS.includes(h)); })
      .on('data', (row) => {
        const col = EMAIL_COLUMNS.find((c) => row[c]);
        const e = clean(col ? row[col] : '');
        if (looksLikeEmail(e)) found.push(e);
      })
      .on('end', () => finish(headerHasEmail && found.length ? found : fromPlainText(text)))
      .on('error', () => finish(fromPlainText(text)));
  });
}

module.exports = { parseEmailFile, fromPlainText, looksLikeEmail };
