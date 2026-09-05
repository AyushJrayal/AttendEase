const mongoose = require("mongoose");

const canteenOwnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("CanteenOwner", canteenOwnerSchema);