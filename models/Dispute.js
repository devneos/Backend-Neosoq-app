const mongoose = require('mongoose');

const LocalizedString = new mongoose.Schema({
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
}, { _id: false });

const DisputeSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accusedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueType: { type: String, required: true },
  description: { type: LocalizedString },
  status: { type: String, enum: ['open','resolved','rejected'], default: 'open' },
  priority: { type: String, enum: ['normal','urgent'], default: 'normal' },
  flagged: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Dispute', DisputeSchema);
