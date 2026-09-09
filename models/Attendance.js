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

attendanceSchema.index({ studentId: 1, sessionId: 1 });
attendanceSchema.index({ studentId: 1, date: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);