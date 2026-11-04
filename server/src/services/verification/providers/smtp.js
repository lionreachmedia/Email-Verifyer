/**
 * Built-in SMTP mailbox check (no API, no cost).
 *
 * Talks to the domain's MX server exactly like a sending mail server would, but
 * stops after RCPT TO — no email is ever sent. It only gives a trustworthy answer when:
 *   - outbound TCP port 25 is open on this server (most home ISPs and many clouds block it),
 *   - SMTP_HELO_HOST is a hostname you own whose reverse DNS (PTR) points back to this server,
 *   - SMTP_MAIL_FROM is an address on a domain you own.
 * Whenever the conversation is inconclusive we return "unknown" — never "invalid".
 */
const net = require('net');
const crypto = require('crypto');
const { env } = require('../../../config/env');
const cache = require('../cache');

// Mail systems that answer "250 OK" for every recipient, so SMTP can't tell
// real from fake. We hand these to the next provider instead of guessing.
const SMTP_BLIND_MX = [/\.yahoodns\.net$/, /\.aol\.com$/, /\.mail\.ru$/];

const BLOCK_WORDS = /(block|blacklist|blocklist|black list|spamhaus|spam|reputation|policy|banned|denied|not allowed|rbl|dnsbl|ptr|reverse|helo|client host|too many|rate limit|unusual|relay)/i;
const NO_USER_WORDS = /(user unknown|unknown user|no such user|does not exist|doesn't exist|not exist|no mailbox|mailbox not found|mailbox unavailable|invalid recipient|recipient rejected|recipient address rejected|address rejected|unknown recipient|recipient not found|undeliverable|no such recipient|not a valid|account.*(disabled|inactive|suspended)|user not found|invalid mailbox|unrouteable)/i;
const FULL_WORDS = /(mailbox full|quota|over quota|insufficient storage|storage)/i;

/** Classify the server's reply to RCPT TO. */
function classifyRcpt(code, text = '') {
  const enhanced = (text.match(/\b([245])\.(\d{1,3})\.(\d{1,3})\b/) || [])[0] || '';
  if (code === 250 || code === 251) return 'accepted';
  if (code === 252) return 'unverifiable';
  if (code === 452 && FULL_WORDS.test(text)) return 'full';
  if (code === 552 || enhanced.startsWith('5.2.2') || enhanced.startsWith('4.2.2')) return 'full';
  if (code >= 400 && code < 500) return 'temp';
  if (code >= 500 && code < 600) {
    if (/^5\.1\./.test(enhanced) || enhanced === '5.2.1' || enhanced === '5.4.1') return 'rejected';
    if (/^5\.7\./.test(enhanced)) return NO_USER_WORDS.test(text) ? 'rejected' : 'blocked';
    if (NO_USER_WORDS.test(text)) return 'rejected';
    if (BLOCK_WORDS.test(text)) return 'blocked';
    if (code === 550 || code === 553 || code === 501 || code === 511) return 'rejected';
    return 'blocked'; // 554 etc. without a clear "no such user" → policy, not proof
  }
  return 'unverifiable';
}

/**
 * One SMTP conversation: banner → EHLO → MAIL FROM → RCPT real → RCPT probe → QUIT.
 * Handles replies split across TCP packets and multi-line replies ("250-…" … "250 …").
 */
function converse(host, rcpts, opts) {
  const { port, heloHost, mailFrom, timeoutMs } = opts;
  return new Promise((resolve) => {
    let buffer = '';
    let multi = [];
    let stage = 'banner';
    let rcptIndex = 0;
    let usedHelo = false;
    const replies = [];
    let finished = false;

    const socket = net.createConnection({ host, port });
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { socket.write('QUIT\r\n'); } catch { /* ignore */ }
      socket.destroy();
      resolve({ host, ...result, replies });
    };
    const timer = setTimeout(() => finish({ outcome: stage === 'banner' && !replies.length ? 'connect_timeout' : 'timeout', stage }), timeoutMs);
    const send = (line) => socket.write(line + '\r\n');

    socket.on('error', (err) => finish({ outcome: 'connect_error', stage, error: err.code || err.message }));
    socket.on('close', () => finish({ outcome: 'closed', stage }));

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (!/^\d{3}/.test(line)) continue;
        multi.push(line);
        if (line[3] === '-') continue; // more lines of the same reply follow
        const code = parseInt(line.slice(0, 3), 10);
        const text = multi.join(' ').slice(0, 300);
        multi = [];
        replies.push({ stage, code, text });
        handle(code, text);
        if (finished) return;
      }
    });

    function handle(code, text) {
      switch (stage) {
        case 'banner':
          if (code !== 220) return finish({ outcome: 'blocked', stage, code, text });
          stage = 'ehlo'; return send(`EHLO ${heloHost}`);
        case 'ehlo':
          if (code === 250) { stage = 'mail'; return send(`MAIL FROM:<${mailFrom}>`); }
          if (!usedHelo && code >= 500) { usedHelo = true; return send(`HELO ${heloHost}`); }
          return finish({ outcome: code >= 400 && code < 500 ? 'temp' : 'blocked', stage, code, text });
        case 'mail':
          if (code === 250) { stage = 'rcpt'; return send(`RCPT TO:<${rcpts[0]}>`); }
          return finish({ outcome: code >= 400 && code < 500 ? 'temp' : 'blocked', stage, code, text });
        case 'rcpt': {
          const verdict = classifyRcpt(code, text);
          if (rcptIndex === 0) {
            // Only probe for catch-all when the real address was accepted.
            if (verdict === 'accepted' && rcpts[1]) { rcptIndex = 1; return send(`RCPT TO:<${rcpts[1]}>`); }
            return finish({ outcome: 'answered', code, text, verdict, probe: null });
          }
          const first = replies.filter((r) => r.stage === 'rcpt')[0];
          return finish({ outcome: 'answered', code: first.code, text: first.text, verdict: 'accepted', probe: verdict });
        }
        default:
          return undefined;
      }
    }
  });
}

const randomProbe = (domain) => `mg-${crypto.randomBytes(8).toString('hex')}-nonexistent@${domain}`;

const smtpProvider = {
  name: 'smtp',
  isConfigured: () => Boolean(env.smtp.heloHost && env.smtp.mailFrom),
  missingConfig: 'Set SMTP_HELO_HOST and SMTP_MAIL_FROM (and make sure outbound port 25 is open).',

  async check(email, ctx, opts = {}) {
    const o = {
      port: opts.port || env.smtp.port,
      heloHost: opts.heloHost || env.smtp.heloHost,
      mailFrom: opts.mailFrom || env.smtp.mailFrom,
      timeoutMs: opts.timeoutMs || env.smtp.timeoutMs,
    };
    const hosts = (ctx.mxHosts || []).slice(0, 3);
    if (!hosts.length) return { verdict: 'unknown', reason: 'no_mail_server', details: 'No MX host to talk to.' };

    if (hosts.some((h) => SMTP_BLIND_MX.some((re) => re.test(h)))) {
      return { verdict: 'unknown', reason: 'smtp_blind_provider', details: `${ctx.domain} accepts every address at SMTP level, so SMTP can't confirm this mailbox.` };
    }

    const domainKey = `catchall:${ctx.domain}`;
    const knownCatchAll = await cache.get(domainKey);
    if (knownCatchAll === true) {
      return { verdict: 'catch_all', reason: 'accept_all', catchAll: true, details: 'This domain accepts mail for any address (cached).' };
    }

    let last;
    for (const host of hosts) {
      last = await converse(host, [email, randomProbe(ctx.domain)], o);
      // Try the next MX only when we couldn't even talk to this one.
      if (!['connect_error', 'connect_timeout', 'closed'].includes(last.outcome)) break;
    }
    const raw = last.text || last.error || last.outcome;

    if (last.outcome === 'connect_error' || last.outcome === 'connect_timeout') {
      return {
        verdict: 'unknown', reason: 'smtp_unreachable', raw, providerError: true,
        details: `Could not connect to ${hosts.join(', ')} on port ${o.port}. Outbound port 25 is probably blocked on this server.`,
      };
    }
    if (last.outcome === 'timeout' || last.outcome === 'closed') {
      return { verdict: 'unknown', reason: 'smtp_timeout', raw, details: 'The mail server stopped responding mid-conversation.' };
    }
    if (last.outcome === 'blocked') {
      return { verdict: 'unknown', reason: 'smtp_blocked', raw, details: 'The mail server refused our verification connection (IP reputation or policy). This says nothing about the mailbox.' };
    }
    if (last.outcome === 'temp') {
      return { verdict: 'unknown', reason: 'greylisted', raw, details: 'The mail server asked us to try later (greylisting or rate limit).' };
    }

    switch (last.verdict) {
      case 'accepted':
        if (last.probe === 'accepted') {
          await cache.set(domainKey, true, 24 * 3600);
          return { verdict: 'catch_all', reason: 'accept_all', catchAll: true, raw, details: 'The server accepts any address at this domain, so the mailbox cannot be confirmed.' };
        }
        if (last.probe === 'rejected') await cache.set(domainKey, false, 24 * 3600);
        return {
          verdict: 'deliverable', reason: 'mailbox_exists', raw,
          catchAll: last.probe === 'rejected' ? false : null,
          details: last.probe === 'rejected' ? 'The mail server confirmed this mailbox exists.' : 'The mail server accepted this mailbox; the catch-all test was inconclusive.',
        };
      case 'rejected':
        return { verdict: 'undeliverable', reason: 'mailbox_not_found', raw, details: 'The mail server says this mailbox does not exist.' };
      case 'full':
        return { verdict: 'full', reason: 'mailbox_full', raw, details: 'The mailbox exists but is full, so mail will bounce for now.' };
      case 'temp':
        return { verdict: 'unknown', reason: 'greylisted', raw, details: 'The mail server asked us to try later (greylisting or rate limit).' };
      case 'blocked':
        return { verdict: 'unknown', reason: 'smtp_blocked', raw, details: 'The mail server refused our check for policy reasons. This says nothing about the mailbox.' };
      default:
        return { verdict: 'unknown', reason: 'smtp_unverifiable', raw, details: 'The mail server would not confirm or deny this mailbox.' };
    }
  },
};

module.exports = smtpProvider;
module.exports.classifyRcpt = classifyRcpt;
module.exports.converse = converse;
