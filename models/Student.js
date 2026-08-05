const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    fatherName: {
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

    department: {
        type: String,
        required: true
    },

    mobile: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

 photo: {
    type: String,
    default: "/images/default-user.png"
},

    state: {
        type: String,
        required: true
    },

    district: {
        type: String,
        required: true
    },

    city: {
        type: String,
        required: true
    },

    address: {
        type: String,
        required: true
    },

    pincode: {
        type: String,
        required: true
    },

    dob: {
        type: Date,
        required: true
    }

});

module.exports = mongoose.model("Student", studentSchema);