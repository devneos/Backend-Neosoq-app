const mongoose = require('mongoose');
const { Schema } = mongoose;

//Token for user phone verification
const TokenSchema = new Schema({
    phoneNumber: {
        type: String,
        ref: 'user',
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
    purpose: {
        type: String, //'phone', 'email', or 'forgotpassword'
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 5 * 60000), // 5 minutes from now
    },
    verified: {
        type: Boolean,
        default: false,
    }
});

const TokenModel = mongoose.model('Token', TokenSchema);

module.exports = TokenModel;
