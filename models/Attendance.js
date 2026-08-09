const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AttendanceSession",
        required: true
    },

    present: {
        type: Boolean,
        required: true
    },

    markedAt: {
        type: Date
    },

    date: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Attendance", attendanceSchema);