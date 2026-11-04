const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const h = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const limits = require('../middleware/rateLimits');
const { protect } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const auth = require('../controllers/authController');
const verify = require('../controllers/verifyController');
const analytics = require('../controllers/analyticsController');
const user = require('../controllers/userController');

const router = express.Router();

const emailField = body('email').isString().trim().isLength({ min: 3, max: 254 }).withMessage('Enter an email address');
const passwordField = body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters');

// ── Auth ───────────────────────────────────────────────────────────────────
router.post('/auth/register', limits.auth,
  [body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Enter your name'), emailField.isEmail().withMessage('Enter a valid email'), passwordField],
  validate, h(auth.register));
router.post('/auth/verify-otp', limits.otp,
  [emailField, body('otp').isString().matches(/^\d{6}$/).withMessage('The code is 6 digits')], validate, h(auth.verifyOtp));
router.post('/auth/resend-otp', limits.otp, [emailField], validate, h(auth.resendOtp));
router.post('/auth/login', limits.auth, [emailField, body('password').isString().notEmpty().withMessage('Enter your password')], validate, h(auth.login));
router.post('/auth/forgot-password', limits.auth, [emailField], validate, h(auth.forgotPassword));
router.post('/auth/reset-password', limits.auth, [body('token').isString().isLength({ min: 64, max: 64 }).withMessage('Invalid reset link'), passwordField], validate, h(auth.resetPassword));
router.get('/auth/me', protect, h(auth.me));

// ── Verification ──────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (['.csv', '.txt'].includes(path.extname(file.originalname).toLowerCase())
    ? cb(null, true)
    : cb(new AppError('Only .csv or .txt files are allowed', 400))),
});

router.post('/verify/single', protect, limits.verify, [body('email').isString().trim().isLength({ min: 1, max: 320 }).withMessage('Enter an email address')], validate, h(verify.single));
router.post('/verify/bulk', protect, upload.single('file'), h(verify.bulk));
router.get('/verify/bulk/:jobId', protect, h(verify.bulkStatus));
router.get('/verify/jobs', protect, h(verify.jobs));
router.get('/verify/history', protect, h(verify.history));
router.get('/verify/export', protect, h(verify.exportCsv));

// ── Analytics ─────────────────────────────────────────────────────────────
router.get('/analytics/stats', protect, h(analytics.stats));
router.get('/analytics/chart', protect, h(analytics.chart));

// ── Account ───────────────────────────────────────────────────────────────
router.put('/user/profile', protect, [body('name').isString().trim().isLength({ min: 1, max: 80 })], validate, h(user.updateProfile));
router.post('/user/api-key', protect, h(user.createApiKey));
router.delete('/user/api-key', protect, h(user.revokeApiKey));
router.get('/system/status', protect, h(user.systemStatus));

module.exports = router;
