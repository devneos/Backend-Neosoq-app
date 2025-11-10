const mongoose = require('mongoose');

const LocalizedString = new mongoose.Schema({
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
}, { _id: false });

const FileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  mimeType: String,
  size: Number,
  path: String,
  urlSrc: String,
  description: { type: LocalizedString, default: () => ({ en: '', ar: '' }) },
}, { _id: false });

const ListingSchema = new mongoose.Schema({
  category: { type: String, required: true },
  subCategory: { type: String },
  title: { type: LocalizedString, required: true },
  description: { type: LocalizedString },
  price: { type: Number },
  quantity: { type: Number, default: 1 },
  condition: { type: String },
  files: [FileSchema],
  images: [String], // image URLs
  reviewCompleted: { type: Boolean, default: false },
  status: { type: String, enum: ['open', 'closed', 'awarded'], default: 'open' },
  isPromoted: { type: Boolean, default: false },
  likesCount: { type: Number, default: 0 },
  sellerRating: { type: Number, default: 5.0 },
  sellerType: { type: String, default: 'seller' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  awardedOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
  awardedAt: { type: Date },
}, { timestamps: true });

// virtual for offers count can be populated with aggregation or separate query
ListingSchema.virtual('offersCount').get(function () {
  // placeholder; actual count should be populated via aggregation in controller
  return this._offersCount || 0;
});

ListingSchema.set('toJSON', { virtuals: true });
ListingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Listing', ListingSchema);
