const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serveClient: bool(process.env.SERVE_CLIENT, false),
  trustProxy: int(process.env.TRUST_PROXY, 0),

  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mailguard',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '7d',

  mail: {
    host: process.env.MAIL_HOST,
    port: int(process.env.MAIL_PORT, 587),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    fromEmail: process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER,
    fromName: process.env.MAIL_FROM_NAME || 'MailGuard',
  },

  credits: { signup: int(process.env.SIGNUP_CREDITS, 100) },

  verify: {
    // Order matters: the first provider that gives a definitive answer wins.
    providers: list(process.env.VERIFY_PROVIDERS),
    cacheTtlHours: int(process.env.VERIFY_CACHE_TTL_HOURS, 72),
    bulkMaxEmails: int(process.env.BULK_MAX_EMAILS, 100000),
    bulkBatchSize: int(process.env.BULK_BATCH_SIZE, 25),
    workerConcurrency: int(process.env.WORKER_CONCURRENCY, 2),
    emailConcurrency: int(process.env.WORKER_EMAIL_CONCURRENCY, 4),
    providerTimeoutMs: int(process.env.PROVIDER_TIMEOUT_MS, 30000),
  },

  keys: {
    reacherUrl: (process.env.REACHER_URL || '').replace(/\/+$/, ''),
    reacherSecret: process.env.REACHER_SECRET,
    reacherApiKey: process.env.REACHER_API_KEY,
    reoon: process.env.REOON_API_KEY,
    reoonMode: (process.env.REOON_MODE || 'power').toLowerCase(),
    zerobounce: process.env.ZEROBOUNCE_API_KEY,
    emailable: process.env.EMAILABLE_API_KEY,
    kickbox: process.env.KICKBOX_API_KEY,
    hunter: process.env.HUNTER_API_KEY,
  },
};

function assertEnv() {
  const problems = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) problems.push('JWT_SECRET must be set and at least 32 characters');
  if (problems.length) throw new Error('Invalid configuration:\n  - ' + problems.join('\n  - '));
}

module.exports = { env, assertEnv };
