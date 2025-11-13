const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  response: { type: Object },
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
