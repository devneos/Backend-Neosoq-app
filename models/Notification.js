const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true }, // e.g. 'chat_message', 'offer_created', 'listing_approved'
  title: { type: String },
  body: { type: String },
  link: { type: String },
  data: { type: Schema.Types.Mixed },
  read: { type: Boolean, default: false },
  // Delivery tracking for background worker
  delivered: { type: Boolean, default: false, index: true },
  deliveredAt: { type: Date },
  // simple retry counter for transient failures
  deliveryAttempts: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);

