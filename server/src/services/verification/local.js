/**
 * Checks that need no network: syntax, disposable, role, free provider, typo suggestion.
 */
const validator = require('validator');
const disposableList = require('disposable-email-domains');
const disposableWildcards = require('disposable-email-domains/wildcard.json');

const DISPOSABLE = new Set(disposableList);
const DISPOSABLE_WILDCARD = new Set(disposableWildcards);

// Forwarding/alias services are real inboxes, not throwaway ones.
const NOT_DISPOSABLE = new Set(['anonaddy.com', 'anonaddy.me', 'simplelogin.com', 'simplelogin.io', 'duck.com', 'privaterelay.appleid.com']);

const ROLE_LOCALS = new Set([
  'admin', 'administrator', 'support', 'info', 'sales', 'contact', 'help', 'helpdesk', 'no-reply', 'noreply',
  'donotreply', 'do-not-reply', 'billing', 'accounts', 'accounting', 'finance', 'legal', 'security', 'abuse',
  'webmaster', 'postmaster', 'hostmaster', 'office', 'team', 'marketing', 'hello', 'feedback', 'press', 'media',
  'jobs', 'careers', 'hr', 'recruitment', 'service', 'services', 'enquiries', 'enquiry', 'inquiries', 'newsletter',
  'notifications', 'alerts', 'orders', 'privacy', 'compliance', 'it', 'root', 'sysadmin', 'devnull',
]);

const FREE_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'protonmail.com', 'proton.me', 'pm.me', 'zoho.com', 'zohomail.com', 'yandex.com', 'yandex.ru', 'gmx.com', 'gmx.de',
  'mail.com', 'tutanota.com', 'fastmail.com', 'rediffmail.com', 'web.de', 'qq.com', '163.com', 'hey.com',
]);

// Domains people commonly mistype, used for "did you mean …?" suggestions only.
const POPULAR = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com',
  'protonmail.com', 'yahoo.co.in', 'rediffmail.com', 'zoho.com', 'gmx.com', 'msn.com', 'yandex.com'];

function validSyntax(email) {
  if (!email || email.length > 254) return false;
  const [local] = email.split('@');
  if (!local || local.length > 64) return false;
  return validator.isEmail(email, { require_tld: true, allow_ip_domain: false, allow_utf8_local_part: true });
}

function isDisposable(domain) {
  if (NOT_DISPOSABLE.has(domain)) return false;
  if (DISPOSABLE.has(domain)) return true;
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i += 1) {
    if (DISPOSABLE_WILDCARD.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

function isRole(local) {
  const base = local.split('+')[0].replace(/[._-]?\d+$/, '');
  return ROLE_LOCALS.has(base);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function suggestDomain(domain) {
  if (POPULAR.includes(domain)) return null;
  let best = null;
  let bestDist = 3;
  for (const p of POPULAR) {
    const d = levenshtein(domain, p);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best && bestDist <= 2 ? best : null;
}

function analyze(email) {
  const at = email.lastIndexOf('@');
  const local = at > 0 ? email.slice(0, at) : email;
  const domain = at > 0 ? email.slice(at + 1) : '';
  const syntaxValid = validSyntax(email);
  const suggestedDomain = domain ? suggestDomain(domain) : null;
  return {
    local,
    domain,
    syntaxValid,
    disposable: syntaxValid ? isDisposable(domain) : false,
    roleBased: syntaxValid ? isRole(local) : false,
    freeProvider: FREE_PROVIDERS.has(domain),
    suggestion: suggestedDomain ? `${local}@${suggestedDomain}` : null,
  };
}

module.exports = { analyze, isDisposable, isRole, validSyntax, suggestDomain };
