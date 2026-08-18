const mongoose = require("mongoose");

const festSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    fatherName: {
        type: String,
        required: true
    },

    department: {
        type: String,
        required: true
    },

    rollNo: {
        type: String,
        required: true,
        unique: true
    },

    semester: {
        type: Number,
        required: true
    },

    section: {
        type: String,
        required: true
    },

    

    // Youth Festival Event
    event: {
        type: String,
        required: true
    },

    mobile: {
        type: String,
        required: true
    }

});

module.exports = mongoose.model("fest", festSchema);