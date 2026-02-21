import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected");

    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = await Admin.create({
      fullName: "Main Admin",
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin Created:", admin);
    process.exit();
  } catch (err) {
    console.log("Error:", err);
    process.exit(1);
  }
};

createAdmin();
