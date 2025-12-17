const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  escrowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow' },
  amount: { type: Number, required: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'completed', 'disputed', 'cancelled'], default: 'active' },
  completedByBuyer: { type: Boolean, default: false },
  completedByWorker: { type: Boolean, default: false },
  completedAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: { type: Date },
  cancelReason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Contract', ContractSchema);
