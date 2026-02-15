const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },

    title: String,
    description: String,
    skillsRequired: [String],
    budget: Number,
    deadline: Date,

    status: {
        type: String,
        enum: ["open", "assigned", "completed", "disputed"],
        default: "open"
    },

    assignedcreator: { type: mongoose.Schema.Types.ObjectId, ref: "Creator" },
    assignedbrand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" }
});

module.exports = mongoose.model('Project', projectSchema);