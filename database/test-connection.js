
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/config/db");

async function testConnection() {
  try {
    await connectDB();

    console.log("Database name:", mongoose.connection.name);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testConnection();
