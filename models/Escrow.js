const mongoose = require('mongoose');

const ReleaseHistorySchema = new mongoose.Schema(
  {
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['release', 'refund', 'hold'], required: true },
    amount: { type: Number },
    note: { type: String },
  },
  { timestamps: true }
);

// Unified Escrow schema that supports listing/request/offer flows and legacy fields.
const EscrowSchema = new mongoose.Schema(
  {
    // generalized
    type: { type: String, enum: ['listing', 'request', 'other'], default: 'other' },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    itemName: { type: String },

    // explicit role fields used across controllers
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // pointers to related domain objects
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },

    amount: { type: Number, required: true },
    paymentMethod: { type: String },
    status: { type: String, enum: ['held', 'active', 'released', 'completed', 'cancelled', 'disputed', 'refunded'], default: 'active', index: true },
    confirmations: { buyer: { type: Boolean, default: false }, worker: { type: Boolean, default: false } },
    lockedLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },

    releaseHistory: [ReleaseHistorySchema],
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Escrow', EscrowSchema);
