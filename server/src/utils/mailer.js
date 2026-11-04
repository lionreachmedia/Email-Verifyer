const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('./logger');

const configured = Boolean(env.mail.host && env.mail.user && env.mail.pass);
const transporter = configured
  ? nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: { user: env.mail.user, pass: env.mail.pass },
  })
  : null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const layout = (title, body) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#0a0b0d;color:#e8eaf0;border-radius:12px">
  <h2 style="color:#4f8ef7;margin:0 0 16px">${esc(env.mail.fromName)} — ${esc(title)}</h2>
  ${body}
</div>`;

/**
 * Sends an email. Returns true when sent.
 * Without MAIL_* settings in development, the message is printed to the
 * server console instead, so you can still sign up locally.
 */
async function send({ to, subject, html, devText }) {
  if (!transporter) {
    if (env.isProd) throw new Error('Email is not configured (MAIL_HOST/MAIL_USER/MAIL_PASS)');
    logger.warn(`[mail:dev] Email not configured — would send to ${to}: "${subject}" ${devText || ''}`);
    return 'console';
  }
  await transporter.sendMail({ from: `"${env.mail.fromName}" <${env.mail.fromEmail}>`, to, subject, html });
  logger.info(`Email sent to ${to}: ${subject}`);
  return true;
}

async function trySend(opts) {
  try { return await send(opts); } catch (err) {
    logger.error(`Email to ${opts.to} failed: ${err.message}`);
    return false;
  }
}

const sendOtp = (email, name, otp) => trySend({
  to: email,
  subject: `Your ${env.mail.fromName} verification code`,
  devText: `OTP=${otp}`,
  html: layout('Verify your email', `
    <p>Hi ${esc(name)}, here's your verification code:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#4f8ef7;margin:24px 0;text-align:center">${otp}</div>
    <p style="color:#8b90a0;font-size:13px">It expires in 10 minutes. If you didn't sign up, ignore this email.</p>`),
});

const sendPasswordReset = (email, name, url) => trySend({
  to: email,
  subject: `Reset your ${env.mail.fromName} password`,
  devText: `URL=${url}`,
  html: layout('Reset password', `
    <p>Hi ${esc(name)}, use the button below to choose a new password.</p>
    <a href="${esc(url)}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#4f8ef7;color:#fff;text-decoration:none;border-radius:8px">Reset password</a>
    <p style="color:#8b90a0;font-size:13px">The link expires in 30 minutes. If you didn't ask for this, ignore this email.</p>`),
});

module.exports = { sendOtp, sendPasswordReset, isMailConfigured: () => configured, verifyTransport: () => transporter?.verify() };
