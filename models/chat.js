const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "Creator" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" }
});

module.exports = mongoose.model("Chat", chatSchema);