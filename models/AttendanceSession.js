const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema({

    department: {
        type: String,
        required: false
    },

    semester: {
        type: Number,
        required: false
    },

    section: {
        type: String,
        required: false
    },

    subject: {
        type: String,
        required: true
    },

    isGlobal: {
        type: Boolean,
        default: false
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