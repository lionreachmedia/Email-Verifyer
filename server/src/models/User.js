const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  isVerified: { type: Boolean, default: false },

  otpHash: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  otpSentAt: { type: Date, select: false },

  resetTokenHash: { type: String, select: false },
  resetTokenExpiry: { type: Date, select: false },
  passwordChangedAt: { type: Date },

  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  credits: { type: Number, default: 100, min: 0 },
  totalVerified: { type: Number, default: 0 },

  apiKeyHash: { type: String, unique: true, sparse: true, select: false },
  apiKeyPrefix: { type: String },
  apiKeyCreatedAt: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// True when the JWT was issued before the last password change.
userSchema.methods.tokenIssuedBeforePasswordChange = function (iatSeconds) {
  return Boolean(this.passwordChangedAt && iatSeconds * 1000 < this.passwordChangedAt.getTime());
};

userSchema.methods.toJSON = function toJSON() {
  const o = this.toObject();
  ['password', 'otpHash', 'otpExpiry', 'otpAttempts', 'otpSentAt', 'resetTokenHash', 'resetTokenExpiry', 'apiKeyHash', '__v']
    .forEach((k) => delete o[k]);
  return o;
};

module.exports = mongoose.model('User', userSchema);
