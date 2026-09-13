const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({

    follower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    following: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "accepted"],
        default: "accepted"
    }

}, { timestamps: true });

// Prevent the same follow relationship being created twice
followSchema.index({ follower: 1, following: 1 }, { unique: true });

module.exports = mongoose.model("Follow", followSchema);