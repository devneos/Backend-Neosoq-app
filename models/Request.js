const mongoose = require('mongoose');

const LocalizedString = new mongoose.Schema({
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
}, { _id: false });

const RequestSchema = new mongoose.Schema({
  title: { type: LocalizedString, required: true },
  description: { type: LocalizedString },
  projectType: { type: String, enum: ['ongoing','one-time'], default: 'one-time' },
  pricingType: { type: String, enum: ['fixed','openToOffer'], default: 'openToOffer' },
  price: { type: Number },
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
  images: [String],
  isPromoted: { type: Boolean, default: false },
  status: { type: String, enum: ['open','closed','awarded'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  awardedOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null },
  awardedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Request', RequestSchema);
