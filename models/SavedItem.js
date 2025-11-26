const mongoose = require('mongoose');
const { Schema } = mongoose;

const SavedItemSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemType: { type: String, enum: ['listing','request','post'], required: true },
  itemId: { type: Schema.Types.ObjectId, required: true },
  meta: { type: Schema.Types.Mixed },
}, { timestamps: true });

SavedItemSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('SavedItem', SavedItemSchema);

