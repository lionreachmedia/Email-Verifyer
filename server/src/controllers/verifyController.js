const { verifyEmail } = require('../services/verification');
const Verification = require('../models/Verification');
const BulkJob = require('../models/BulkJob');
const User = require('../models/User');
const credits = require('../services/credits');
const bulk = require('../services/bulk');
const AppError = require('../utils/AppError');
const { parseEmailFile } = require('../utils/csv');
const { escapeRegex, csvCell } = require('../utils/email');
const { env } = require('../config/env');

exports.single = async (req, res) => {
  await credits.charge(req.user._id, 1);
  let result;
  try {
    result = await verifyEmail(req.body.email);
  } catch (err) {
    await credits.refund(req.user._id, 1);
    throw err;
  }
  const doc = await Verification.create({ userId: req.user._id, ...result });
  // No charge when we couldn't give an answer.
  if (result.status === 'unknown') await credits.refund(req.user._id, 1);
  else await User.updateOne({ _id: req.user._id }, { $inc: { totalVerified: 1 } });

  const user = await User.findById(req.user._id).select('credits');
  res.json({ success: true, data: doc, credits: user.credits });
};

exports.bulk = async (req, res) => {
  if (!req.file || !req.file.buffer?.length) throw new AppError('Upload a .csv or .txt file in the "file" field.', 400);

  const { emails, duplicates } = await parseEmailFile(req.file.buffer);
  if (!emails.length) throw new AppError('No email addresses found in this file. Put one email per row, or use a column named "email".', 400);
  if (emails.length > env.verify.bulkMaxEmails) {
    throw new AppError(`This file has ${emails.length.toLocaleString()} emails; the limit is ${env.verify.bulkMaxEmails.toLocaleString()} per upload.`, 400);
  }

  const job = await bulk.createJob({ user: req.user, fileName: req.file.originalname.slice(0, 200), emails, duplicates });
  res.status(202).json({ success: true, ...job, duplicatesRemoved: duplicates, message: `${emails.length.toLocaleString()} emails queued.` });
};

exports.bulkStatus = async (req, res) => {
  const job = await BulkJob.findOne({ jobId: req.params.jobId, userId: req.user._id }).lean();
  if (!job) throw new AppError('Job not found', 404);
  const progress = job.totalEmails ? Math.min(100, Math.floor((job.processedEmails / job.totalEmails) * 100)) : 0;
  res.json({ success: true, data: { ...job, progress } });
};

exports.jobs = async (req, res) => {
  const jobs = await BulkJob.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ success: true, data: jobs.map((j) => ({ ...j, progress: j.totalEmails ? Math.floor((j.processedEmails / j.totalEmails) * 100) : 0 })) });
};

exports.history = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const query = { userId: req.user._id };
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  if (Verification.STATUSES.includes(status)) query.status = status;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  if (search) query.email = { $regex: escapeRegex(search.toLowerCase()) };
  if (typeof req.query.jobId === 'string' && req.query.jobId) query.bulkJobId = req.query.jobId;

  const [rows, total] = await Promise.all([
    Verification.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Verification.countDocuments(query),
  ]);
  res.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

const EXPORT_COLUMNS = [
  ['email', 'email'], ['status', 'status'], ['reason', 'reason'], ['details', 'details'], ['confidence', 'confidence'],
  ['mx_record', 'mxRecord'], ['mailbox', 'mailbox'], ['catch_all', 'catchAll'], ['disposable', 'disposable'],
  ['role_based', 'roleBased'], ['free_provider', 'freeProvider'], ['suggestion', 'suggestion'], ['checked_by', 'provider'], ['verified_at', 'createdAt'],
];

exports.exportCsv = async (req, res) => {
  const query = { userId: req.user._id };
  if (typeof req.query.jobId === 'string' && req.query.jobId) query.bulkJobId = req.query.jobId;
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  if (Verification.STATUSES.includes(status)) query.status = status;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mailguard-${req.query.jobId ? String(req.query.jobId).slice(0, 8) : 'history'}-${Date.now()}.csv"`);
  res.write('\uFEFF' + EXPORT_COLUMNS.map(([h]) => h).join(',') + '\n');

  // Stream so 100k-row exports don't load into memory at once.
  const cursor = Verification.find(query).sort({ createdAt: -1 }).lean().cursor();
  for await (const v of cursor) {
    const row = EXPORT_COLUMNS.map(([, k]) => {
      const val = v[k];
      if (val instanceof Date) return csvCell(val.toISOString());
      if (val === null || val === undefined) return '';
      return csvCell(val);
    });
    res.write(row.join(',') + '\n');
  }
  res.end();
};
