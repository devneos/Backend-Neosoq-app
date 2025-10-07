const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  mimeType: String,
  size: Number,
  path: String,
  urlSrc: String,
}, { _id: false });

const ListingSchema = new mongoose.Schema({
  category: { type: String, required: true },
  subCategory: { type: String },
  title: { type: String, required: true },
  description: { type: String },
  price: { type: String },
  quantity: { type: Number, default: 1 },
  condition: { type: String },
  files: [FileSchema],
  reviewCompleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Listing', ListingSchema);
