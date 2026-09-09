const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({

    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },

    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    senderName: {
        type: String,
        required: true
    },

    messageType: {
        type: String,
        enum: ["text", "system"],
        default: "text"
    },

    text: {
        type: String,
        default: ""
    },

    imageUrl: {
        type: String,
        default: ""
    },

    voiceUrl: {
        type: String,
        default: ""
    },

    status: {
        type: String,
        enum: ["sent", "delivered", "read"],
        default: "sent"
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("GroupMessage", groupMessageSchema);