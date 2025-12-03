// models/Variant.js
import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  images: { type: [String], default: [] }, // <- now an array of image paths
  stock: { type: Number, default: 0, index: true, min: 0 },
  color: { type: String, default: null, index: true },
  price: { type: Number, default: null, index: true, min: 0 },
  salePrice: { type: Number, default: null, index: true, min: 0 },
  isListed: { type: Boolean, default: false, index: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

export default mongoose.model('Variant', VariantSchema);
