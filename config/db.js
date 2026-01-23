// config/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Atlas connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;
