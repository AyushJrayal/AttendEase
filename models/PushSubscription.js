const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({

    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    endpoint: {
        type: String,
        required: true,
        unique: true
    },

    keys: {
        p256dh: {
            type: String,
            required: true
        },
        auth: {
            type: String,
            required: true
        }
    }

}, { timestamps: true });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);