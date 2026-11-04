const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { normalize } = require('../utils/email');
const { sendOtp, sendPasswordReset } = require('../utils/mailer');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_GAP_MS = 60 * 1000;

const signToken = (id) => jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpire });
const hmac = (value) => crypto.createHmac('sha256', env.jwtSecret).update(String(value)).digest('hex');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

async function issueOtp(user) {
  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  user.otpHash = hmac(otp);
  user.otpExpiry = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.otpSentAt = new Date();
  await user.save();
  return sendOtp(user.email, user.name, otp);
}

// Accounts created by the old version had Gmail addresses rewritten
// (dots/+tags removed). Fall back to that form so those users can still sign in.
async function findByEmail(email, select = '') {
  const user = await User.findOne({ email }).select(select);
  if (user) return user;
  const [local, domain] = email.split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const legacy = `${local.split('+')[0].replace(/\./g, '')}@gmail.com`;
    if (legacy !== email) return User.findOne({ email: legacy }).select(select);
  }
  return null;
}

exports.register = async (req, res) => {
  const email = normalize(req.body.email);
  const { name, password } = req.body;

  let user = await User.findOne({ email }).select('+password');
  if (user && user.isVerified) throw new AppError('An account with this email already exists. Sign in instead.', 409);

  if (user) {
    // Unverified leftover (e.g. the code email never arrived): let them start over.
    user.name = name;
    user.password = password;
  } else {
    user = new User({ name, email, password, credits: env.credits.signup });
  }
  await user.save();
  const emailSent = await issueOtp(user);

  res.status(201).json({
    success: true,
    email: user.email,
    emailSent,
    message: emailSent === 'console'
      ? 'Account created. Email sending is not set up yet, so the code is printed in the server terminal.'
      : emailSent
        ? 'Account created. Enter the 6-digit code we emailed you.'
        : 'Account created, but we could not send the code email. Use "Resend code" in a minute.',
  });
};

exports.verifyOtp = async (req, res) => {
  const email = normalize(req.body.email);
  const user = await User.findOne({ email }).select('+otpHash +otpExpiry +otpAttempts');
  if (!user) throw new AppError('Invalid or expired code.', 400);
  if (user.isVerified) throw new AppError('This email is already verified. Sign in instead.', 400);
  if (!user.otpHash || user.otpExpiry < new Date()) throw new AppError('This code has expired. Request a new one.', 400);
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) throw new AppError('Too many wrong codes. Request a new one.', 429);

  const ok = crypto.timingSafeEqual(Buffer.from(user.otpHash), Buffer.from(hmac(String(req.body.otp))));
  if (!ok) {
    user.otpAttempts += 1;
    await user.save();
    throw new AppError(`Wrong code. ${OTP_MAX_ATTEMPTS - user.otpAttempts} attempts left.`, 400);
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpiry = undefined;
  user.otpAttempts = 0;
  await user.save();
  res.json({ success: true, token: signToken(user._id), user });
};

exports.resendOtp = async (req, res) => {
  const email = normalize(req.body.email);
  const user = await User.findOne({ email }).select('+otpSentAt');
  // Same response whether or not the account exists.
  const generic = { success: true, message: 'If that account is waiting for verification, a new code is on its way.' };
  if (!user || user.isVerified) return res.json(generic);

  const wait = user.otpSentAt ? OTP_RESEND_GAP_MS - (Date.now() - user.otpSentAt.getTime()) : 0;
  if (wait > 0) throw new AppError(`Please wait ${Math.ceil(wait / 1000)}s before requesting another code.`, 429);

  const sent = await issueOtp(user);
  if (!sent) throw new AppError('We could not send the email right now. Try again shortly.', 503);
  return res.json(generic);
};

exports.login = async (req, res) => {
  const email = normalize(req.body.email);
  const user = await findByEmail(email, '+password');
  if (!user || !(await user.comparePassword(req.body.password))) throw new AppError('Incorrect email or password.', 401);
  if (!user.isVerified) {
    throw new AppError('Verify your email to continue. We can send you a new code.', 403, { code: 'EMAIL_NOT_VERIFIED', email: user.email });
  }
  res.json({ success: true, token: signToken(user._id), user });
};

exports.forgotPassword = async (req, res) => {
  const email = normalize(req.body.email);
  const user = await findByEmail(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = sha256(token);
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    await sendPasswordReset(user.email, user.name, `${env.clientUrl}/reset-password?token=${token}`);
  }
  res.json({ success: true, message: 'If that email has an account, a reset link is on its way.' });
};

exports.resetPassword = async (req, res) => {
  const user = await User.findOne({
    resetTokenHash: sha256(req.body.token),
    resetTokenExpiry: { $gt: new Date() },
  }).select('+password');
  if (!user) throw new AppError('This reset link is invalid or has expired. Request a new one.', 400);

  user.password = req.body.password;
  user.resetTokenHash = undefined;
  user.resetTokenExpiry = undefined;
  user.isVerified = true; // they proved they own the inbox
  await user.save();
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
};

exports.me = async (req, res) => res.json({ success: true, user: req.user });
