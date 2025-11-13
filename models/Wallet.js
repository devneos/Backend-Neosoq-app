const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  available: { type: Number, default: 0 },
  locked: { type: Number, default: 0 },
  currency: { type: String, default: 'KWD' },
  updatedAt: { type: Date, default: Date.now }
});

WalletSchema.index({ userId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Wallet', WalletSchema);

// Ensure non-negative balances
WalletSchema.pre('save', function (next) {
  if (this.available < 0) return next(new Error('available balance cannot be negative'));
  if (this.locked < 0) return next(new Error('locked balance cannot be negative'));
  this.updatedAt = new Date();
  return next();
});
