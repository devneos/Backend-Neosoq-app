const mongoose = require('mongoose');

const LocalizedString = new mongoose.Schema({
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
}, { _id: false });

const OfferSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: function() { return !this.requestId } },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: function() { return !this.listingId } },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true },
  proposalText: { type: LocalizedString },
  files: [{
    filename: String,
    originalname: String,
    mimeType: String,
    size: Number,
    path: String,
    urlSrc: String,
    publicId: String,
    description: { type: LocalizedString, default: () => ({ en: '', ar: '' }) },
  }],
  status: { type: String, enum: ['pending','accepted','countered','rejected','completed','withdrawn'], default: 'pending' },
}, { timestamps: true });

OfferSchema.index({ listingId: 1 });

module.exports = mongoose.model('Offer', OfferSchema);
