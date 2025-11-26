const mongoose = require('mongoose');

const PromotionPurchaseSchema = new mongoose.Schema({
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionPlan', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled'], default: 'pending' },
  amount: { type: Number, required: true, min: 0 },
  adminFee: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'unknown' },
  txnId: { type: String, default: null },
  meta: { type: Object, default: {} }
}, { timestamps: true });

PromotionPurchaseSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('PromotionPurchase', PromotionPurchaseSchema);
