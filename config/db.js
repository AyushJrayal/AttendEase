const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://tonistarktonistark61_db_user:UIHcX6SZlmv5cSik@attendease.qahldzq.mongodb.net/AttendEase?retryWrites=true&w=majority&appName=attendease"
    );

    console.log("MongoDB Atlas Connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;