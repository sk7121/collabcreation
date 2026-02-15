const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "Creator" },
    pitch: String,
    status: { type: String, enum: ["pending", "accepted", "rejected"] },
});

module.exports = mongoose.model("Application", applicationSchema);
