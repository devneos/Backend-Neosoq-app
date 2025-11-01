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
  files: [{ filename: String, url: String }],
  images: [String],
  isPromoted: { type: Boolean, default: false },
  status: { type: String, enum: ['open','closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Request', RequestSchema);
