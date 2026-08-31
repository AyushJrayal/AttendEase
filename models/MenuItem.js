const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    price: {
        type: Number,
        required: true
    },

    category: {
        type: String,
        enum: ["Snacks", "Wrap", "Pasta", "Chinese", "Shakes", "Beverages"],
        default: "Snacks"
    },

    photoUrl: {
        type: String,
        default: ""
    },

    available: {
        type: Boolean,
        default: true
    },

    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher"
    }

}, { timestamps: true });

module.exports = mongoose.model("MenuItem", menuItemSchema);