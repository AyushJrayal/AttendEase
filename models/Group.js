const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    photoUrl: {
        type: String,
        default: ""
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    members: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student"
        }
    ]

}, {
    timestamps: true
});

module.exports = mongoose.model("Group", groupSchema);