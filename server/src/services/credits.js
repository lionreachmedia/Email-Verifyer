const User = require('../models/User');
const AppError = require('../utils/AppError');

/** Atomically take `n` credits; fails with 402 if the balance is too low. */
async function charge(userId, n) {
  if (n <= 0) return;
  const r = await User.updateOne({ _id: userId, credits: { $gte: n } }, { $inc: { credits: -n } });
  if (!r.modifiedCount) {
    const user = await User.findById(userId).select('credits');
    throw new AppError(`Not enough credits: this needs ${n}, you have ${user ? user.credits : 0}.`, 402, { creditsNeeded: n, credits: user?.credits ?? 0 });
  }
}

async function refund(userId, n) {
  if (n > 0) await User.updateOne({ _id: userId }, { $inc: { credits: n } });
}

module.exports = { charge, refund };
