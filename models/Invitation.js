const mongoose = require("mongoose");
const { Schema } = mongoose;

const InvitationSchema = new Schema(
  {
    email: String,
    role: String,
    token: String,
    position: String,
    adminAccess: [String],
  },
  { timestamps: true }
);

const InvitationModel = mongoose.model("Invitation", InvitationSchema);

module.exports = InvitationModel;
