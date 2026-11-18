const User = require('../models/User');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');

/** Atomically take `n` credits; fails with 402 if the balance is too low.
 *  No-op when USER_CREDITS_ENABLED=false. */
async function charge(userId, n) {
  if (!env.credits.enabled || n <= 0) return;
  const r = await User.updateOne({ _id: userId, credits: { $gte: n } }, { $inc: { credits: -n } });
  if (!r.modifiedCount) {
    const user = await User.findById(userId).select('credits');
    throw new AppError(`Not enough credits: this needs ${n}, you have ${user ? user.credits : 0}.`, 402, { creditsNeeded: n, credits: user?.credits ?? 0 });
  }
}

async function refund(userId, n) {
  if (!env.credits.enabled || n <= 0) return;
  await User.updateOne({ _id: userId }, { $inc: { credits: n } });
}

module.exports = { charge, refund, enabled: () => env.credits.enabled };
