const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema({

    department: {
        type: String,
        required: true
    },

    semester: {
        type: Number,
        required: true
    },

    day: {
        type: String,
        required: true,
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },

    period: {
        type: Number,
        required: true
    },

time: {
    type: String,
    default: ""
},

    subject: {
        type: String,
        required: true
    },

    room: {
        type: String,
        default: ""
    },

    effectiveFrom: {
        type: String,
        default: ""
    }

});

module.exports = mongoose.model("Timetable", timetableSchema);