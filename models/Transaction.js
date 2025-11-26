const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    // High-level semantic type for admin filtering and reporting
    type: {
      type: String,
      enum: ['promotion', 'listing_purchase', 'request_payment', 'refund', 'escrow_payment', 'wallet_topup', 'withdrawal', 'credit', 'debit'],
      required: true,
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'KWD' },
    paymentMethod: { type: String, enum: ['card', 'knet', 'bank_transfer', 'wallet', 'apple_pay', 'myfatoorah', 'other'] },
    status: { type: String, enum: ['failed', 'pending', 'completed'], default: 'pending', index: true },
    escrow: {
      hasEscrow: { type: Boolean, default: false },
      escrowStatus: { type: String, enum: ['held', 'released', 'refunded', 'disputed'] },
    },
    txnId: { type: String, index: true },
    adminFee: { type: Number, default: 0 },
    totalCharged: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
