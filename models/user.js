const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,

    role: {
        type: String,
        enum: ["creator", "brand", "admin"],
        required: true
    },

    isOnboarded: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    trustBadge: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);