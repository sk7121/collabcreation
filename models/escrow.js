const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
    project: ObjectId,
    brand: ObjectId,
    creator: ObjectId,

    amount: Number,

    platformFee: Number, // 7%
    creatorAmount: Number, // 93%

    status: {
        type: String,
        enum: ["held", "released", "refunded"]
    }
});

module.exports = mongoose.model('Escrow', escrowSchema);
