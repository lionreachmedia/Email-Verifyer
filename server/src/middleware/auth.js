const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const hashApiKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

/** Accepts either "Authorization: Bearer <jwt>" or "x-api-key: mg_…". */
async function protect(req, res, next) {
  try {
    const apiKey = req.get('x-api-key');
    if (apiKey) {
      const user = await User.findOne({ apiKeyHash: hashApiKey(apiKey) });
      if (!user) throw new AppError('Invalid API key', 401);
      req.user = user;
      req.authMethod = 'api_key';
      return next();
    }

    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Not signed in', 401);

    let decoded;
    try { decoded = jwt.verify(token, env.jwtSecret); } catch { throw new AppError('Session expired, please sign in again', 401); }

    const user = await User.findById(decoded.id);
    if (!user) throw new AppError('Account not found', 401);
    if (user.tokenIssuedBeforePasswordChange(decoded.iat)) throw new AppError('Password changed, please sign in again', 401);
    if (!user.isVerified) throw new AppError('Please verify your email first', 403);

    req.user = user;
    req.authMethod = 'jwt';
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { protect, hashApiKey };
