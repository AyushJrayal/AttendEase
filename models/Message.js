const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    message: {
        type: String,
        default: ""
    },

    mediaUrl: {
        type: String,
        default: ""
    },

    mediaType: {
        type: String,
        enum: ["", "image"],
        default: ""
    },

    // SENT / DELIVERED / READ
    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    },

    // EDIT MESSAGE
    edited: {
        type: Boolean,
        default: false
    },

    // REPLY MESSAGE
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null
    },

    // DELETED MESSAGE
        deleted: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);