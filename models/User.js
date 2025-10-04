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
