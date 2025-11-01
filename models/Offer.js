const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: function() { return !this.requestId } },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: function() { return !this.listingId } },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true },
  proposalText: { type: String },
  files: [{ filename: String, url: String }],
  status: { type: String, enum: ['pending','accepted','countered','rejected','completed','withdrawn'], default: 'pending' },
}, { timestamps: true });

OfferSchema.index({ listingId: 1 });

module.exports = mongoose.model('Offer', OfferSchema);
