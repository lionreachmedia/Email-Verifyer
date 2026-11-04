const mongoose = require('mongoose');

const bulkJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: String, required: true, unique: true },
  fileName: { type: String, required: true },
  totalEmails: { type: Number, default: 0 },
  processedEmails: { type: Number, default: 0 },
  duplicatesRemoved: { type: Number, default: 0 },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued' },
  results: {
    valid: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 },
    risky: { type: Number, default: 0 },
    catchAll: { type: Number, default: 0 },
    unknown: { type: Number, default: 0 },
  },
  creditsCharged: { type: Number, default: 0 },
  error: { type: String, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('BulkJob', bulkJobSchema);
