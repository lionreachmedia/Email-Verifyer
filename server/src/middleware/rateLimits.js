const rateLimit = require('express-rate-limit');

const make = (windowMin, max, message, keyByUser = false) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message },
  ...(keyByUser && { keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip) }),
});

module.exports = {
  api: make(15, 600, 'Too many requests, slow down a little.'),
  auth: make(15, 30, 'Too many sign-in attempts. Try again in 15 minutes.'),
  otp: make(15, 10, 'Too many code attempts. Try again in 15 minutes.'),
  verify: make(1, 60, 'Too many verifications per minute. Use bulk upload for lists.', true),
};
