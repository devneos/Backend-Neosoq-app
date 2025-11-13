const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
  relatedWalletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: false },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit','debit'], required: true },
  category: { type: String, enum: ['topup','escrow_hold','escrow_release','withdraw','refund','internal'], required: true },
  referenceId: { type: String, required: false, index: true },
  idempotencyKey: { type: String, required: false, index: true },
  balanceAfter: { type: Number, required: true },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

LedgerSchema.set('toJSON', { virtuals: true });
LedgerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ledger', LedgerSchema);
