const mongoose = require("mongoose");
const env = require("./env");

const connectDb = async () => {
  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.warn("⚠️ MongoDB Connection Failed / Unavailable:", err.message);
    console.warn("ℹ️ Running in Resilient Live Mode (In-Memory Auth & Routing Active)");
  }
};

module.exports = connectDb;
