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
  publicId: String,
  description: { type: LocalizedString, default: () => ({ en: '', ar: '' }) },
}, { _id: false });

const PostSchema = new mongoose.Schema({
  message: { type: LocalizedString, required: true },
  files: [FileSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // allow simple flags or metadata in future
}, { timestamps: true });

PostSchema.set('toJSON', { virtuals: true });
PostSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', PostSchema);
