const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema({

    department: {
        type: String,
        required: true
    },

    semester: {
        type: Number,
        required: true
    },

    section: {
        type: String,
        required: true
    },

    subject: {
        type: String,
        required: true
    },

    date: {
        type: String,
        required: true
    },

    isOpen: {
        type: Boolean,
        default: false
    },

    startTime: {
        type: Date,
        required: true
    },

    endTime: {
        type: Date,
        required: true
    }

});

module.exports = mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
 );