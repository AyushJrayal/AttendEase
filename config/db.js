const mongoose = require("mongoose");

async function connectDB() {

    try {

        await mongoose.connect("mongodb://127.0.0.1:27017/attendease");

        console.log("✅ MongoDB Connected");

    } catch (error) {

        console.log(error);

    }

}

module.exports = connectDB;