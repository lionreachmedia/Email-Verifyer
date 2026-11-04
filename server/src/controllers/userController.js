const crypto = require('crypto');
const User = require('../models/User');
const { hashApiKey } = require('../middleware/auth');
const { providersStatus } = require('../services/verification');
const { getRedis } = require('../config/redis');
const { isMailConfigured } = require('../utils/mailer');

exports.updateProfile = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { name: String(req.body.name).trim() }, { runValidators: true });
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
};

// The full key is shown once; only its hash is stored.
exports.createApiKey = async (req, res) => {
  const key = 'mg_' + crypto.randomBytes(24).toString('hex');
  await User.updateOne({ _id: req.user._id }, { apiKeyHash: hashApiKey(key), apiKeyPrefix: key.slice(0, 10), apiKeyCreatedAt: new Date() });
  res.json({ success: true, apiKey: key, message: 'Copy this key now — it will not be shown again.' });
};

exports.revokeApiKey = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { apiKeyHash: 1, apiKeyPrefix: 1, apiKeyCreatedAt: 1 } });
  res.json({ success: true });
};

exports.systemStatus = async (req, res) => {
  let workerOnline = false;
  try { workerOnline = Boolean(await getRedis().get('mg:worker:heartbeat')); } catch { /* redis down */ }
  const providers = providersStatus();
  res.json({
    success: true,
    data: {
      workerOnline,
      mailConfigured: isMailConfigured(),
      providers,
      mailboxChecksEnabled: providers.some((p) => p.configured),
    },
  });
};
