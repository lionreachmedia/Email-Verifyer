const mongoose = require('mongoose');

const STATUSES = ['valid', 'invalid', 'risky', 'catch-all', 'unknown'];

const verificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bulkJobId: { type: String, default: null },
  email: { type: String, required: true, lowercase: true, trim: true },

  status: { type: String, enum: STATUSES, required: true },
  reason: { type: String, required: true },       // machine code, e.g. mailbox_not_found
  details: { type: String, default: '' },         // human explanation
  confidence: { type: Number, min: 0, max: 100, default: 0 },

  syntaxValid: { type: Boolean, default: false },
  domainExists: { type: Boolean, default: false }, // null = couldn't tell (DNS failure)
  mxFound: { type: Boolean, default: false },
  mxRecord: { type: String, default: null },
  // 'deliverable' | 'undeliverable' | 'full' | 'unknown' | 'skipped'
  mailbox: { type: String, default: 'skipped' },
  catchAll: { type: Boolean, default: null },
  disposable: { type: Boolean, default: false },
  roleBased: { type: Boolean, default: false },
  freeProvider: { type: Boolean, default: false },
  suggestion: { type: String, default: null },

  provider: { type: String, default: 'local' },   // who produced the mailbox answer
  providerResponse: { type: String, default: null },
  cached: { type: Boolean, default: false },
  durationMs: { type: Number, default: 0 },
}, { timestamps: true });

verificationSchema.index({ userId: 1, createdAt: -1 });
verificationSchema.index({ userId: 1, status: 1 });
verificationSchema.index(
  { bulkJobId: 1, email: 1 },
  { unique: true, partialFilterExpression: { bulkJobId: { $type: 'string' } } },
);

module.exports = mongoose.model('Verification', verificationSchema);
module.exports.STATUSES = STATUSES;
