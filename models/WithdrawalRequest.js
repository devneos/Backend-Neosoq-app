const mongoose = require('mongoose');

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'KWD' },
    method: { type: String, enum: ['bank_transfer', 'knet', 'card', 'other'] },
    accountDetails: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending', index: true },
    adminNote: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);
