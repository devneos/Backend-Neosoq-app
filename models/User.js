const mongoose = require("mongoose");
const { Schema } = mongoose;

//User model
const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: false,
  },
  country: {
    type: String,
    required: false,
  },
  region: {
    type: String,
    required: false,
  },
  // phoneNumber is optional now to support OAuth signups (Google) which may not provide phone
  phoneNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  // Store Google ID for OAuth users
  googleId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  // Provider (e.g., 'google' or 'local')
  provider: {
    type: String,
    required: false,
    default: 'local',
  },
  roles: {
    type: [String],
    default: ["User"],
  },
  position: String,
  adminAccess: [String],
  active: {
    type: Boolean,
    default: true,
  },
  address: String,
  verified: {
    type: Boolean,
    default: false,
  },
  profileImage: String,
  password: {
    type: String,
    required: false, // No longer required for phone-based auth
  },
});

const UserModel = mongoose.model("User", UserSchema);

module.exports = UserModel;

// Ensure indexes exist with the desired options. These calls are idempotent
// when the server starts but will not modify an existing index with different
// options. Use the provided migration script if you need to change an existing index.
try {
  UserSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
  UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
} catch (err) {
  // Indexes will be created by mongoose during connection; ignore errors here.
}
