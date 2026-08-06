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

    date: {
        type: String,
        required: true
    },

    isOpen: {
        type: Boolean,
        default: false
    },

    startTime: {
        type: Date
    },

    endTime: {
        type: Date
    }

});

module.exports = mongoose.model(
    "AttendanceSession",
    attendanceSessionSchema
);
