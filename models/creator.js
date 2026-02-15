const mongoose = require("mongoose");

const creatorProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    skills: [String],
    bio: String,
    portfolioLinks: [String],

    socialLinks: {
        instagram: String,
        youtube: String,
        // tiktok: String
    },

    followers: {
        instagram: Number,
        youtube: Number,
        // tiktok: Number
    },

    // firstReel: String,

    kyc: {
        aadhaar: String,
        pan: String,
        bankAccount: String,
        verified: {
            type: Boolean,
            default: false
        }
    }
});

module.exports = mongoose.model("Creator", creatorProfileSchema);
