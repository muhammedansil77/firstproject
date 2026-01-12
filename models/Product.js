
import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  images: { type: [String], default: [] },
  variants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Variant' }], // <--- store variant ids
  isDeleted: { type: Boolean, default: false },
    status: { 
    type: String, 
    enum: ['active', 'blocked'], 
    default: 'active' 
  },
  deletedAt: Date
}, { timestamps: true });

export default mongoose.model('Product', ProductSchema);
