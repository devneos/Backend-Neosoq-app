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
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
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
