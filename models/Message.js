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

    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    }

}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);