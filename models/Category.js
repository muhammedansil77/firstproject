// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  imagePath: { type: String, default: null }, // public URL (e.g. /uploads/categories/xxxx.jpg)
  active: { type: Boolean, default: true },
  itemCount: { type: Number, default: 0 },

  // soft-delete fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export default mongoose.model('Category', categorySchema);
