const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  token: { type: String, required: true, unique: true, index: true },
  roles: { type: [String], default: ['User'] },
  adminAccess: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date },
});

// TTL is handled by application logic via expiresAt; keep index for quick lookup
InviteSchema.index({ token: 1 });

module.exports = mongoose.model('Invite', InviteSchema);
