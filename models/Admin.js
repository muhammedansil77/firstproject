const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // hashed password
  role: { type: String, default: "admin" }
});

module.exports = mongoose.model("Admin", adminSchema);
