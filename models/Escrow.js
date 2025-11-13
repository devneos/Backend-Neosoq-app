const mongoose = require('mongoose');

const EscrowSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: false },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: false },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: false },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['open','active','completed','cancelled','disputed'], default: 'active' },
  confirmations: { buyer: { type: Boolean, default: false }, worker: { type: Boolean, default: false } },
  lockedLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
}, { timestamps: true });

module.exports = mongoose.model('Escrow', EscrowSchema);
