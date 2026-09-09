const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({

    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    type: {
        type: String,
        enum: ["follow", "message"],
        required: true
    },

    count: {
        type: Number,
        default: 1
    },

    read: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, sender: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);