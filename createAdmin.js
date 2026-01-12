
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

const DB = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/firstproject';

(async () => {
  try {
    console.log("Connecting to:", DB);
    await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });

    const existing = await Admin.findOne({ email: 'admin@example.com' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      await mongoose.disconnect();
      return process.exit(0);
    }

    const hash = await bcrypt.hash('Admin@123', 10);

    const admin = await Admin.create({
      fullName: "Main Admin",
      email: "admin@example.com",
      password: hash
    });

    console.log("ADMIN CREATED:", {
      id: admin._id.toString(),
      email: admin.email,
      createdAt: admin.createdAt
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
})();
