// Plain-language labels for the reason codes returned by the API.
const REASONS = {
  mailbox_exists: 'Mailbox confirmed',
  mailbox_not_found: 'Mailbox does not exist',
  mailbox_disabled: 'Mailbox disabled',
  mailbox_full: 'Mailbox full',
  accept_all: 'Domain accepts every address',
  invalid_syntax: 'Not a valid email format',
  domain_not_found: 'Domain does not exist',
  no_mail_server: 'Domain cannot receive email',
  disposable: 'Temporary / disposable inbox',
  dns_error: 'DNS lookup failed',
  no_provider: 'No mailbox checker configured',
  provider_quota: 'Checker out of credits',
  provider_auth: 'Checker API key rejected',
  provider_error: 'Checker request failed',
  provider_pending: 'Checker still processing',
  provider_unknown: 'Checker could not determine',
  provider_risky: 'Flagged risky by checker',
  spamtrap: 'Known spam trap',
  abuse: 'Known complainer',
  internal_error: 'Verification error',
};

export const reasonLabel = (code) =>
  REASONS[code] || (code ? code.replace(/^(zb|emailable|kickbox)_/, '').replace(/_/g, ' ') : '');

export const PROVIDER_NAMES = {
  local: 'Built-in checks', reoon: 'Reoon', reacher: 'Reacher', zerobounce: 'ZeroBounce',
  emailable: 'Emailable', kickbox: 'Kickbox', hunter: 'Hunter',
};
