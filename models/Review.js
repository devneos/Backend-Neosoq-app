const mongoose = require('mongoose');

const LocalizedString = new mongoose.Schema({
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
}, { _id: false });

const ReviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  reviewedListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: false },
  reviewedRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: false },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: LocalizedString },
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);
