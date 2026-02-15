const mongoose = require("mongoose");

const brandProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    companyName: String,
    address: String,

    documents: {
        pan: String,
        gst: String,
        cin: String
    },

    bankAccount: String,
    verified: Boolean
});

module.exports = mongoose.model("Brand", brandProfileSchema);
