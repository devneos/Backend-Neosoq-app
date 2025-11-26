const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    body: { type: String },
    attachments: [{ url: String, filename: String }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    metadata: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
