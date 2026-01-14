import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

export async function isProductUnavailable(productInput) {
  let product = productInput;

  // 🔁 Normalize product
  if (!product) return true;

  // If ObjectId → fetch product
  if (
    typeof product === 'string' ||
    product instanceof mongoose.Types.ObjectId
  ) {
    product = await Product.findById(product)
      .select('status isDeleted category')
      .lean();
  }

  // If still invalid
  if (!product) return true;

  // ❌ PRODUCT CHECK
  if (product.isDeleted === true) return true;
  if (product.status === 'blocked') return true;

  // ❌ CATEGORY CHECK
  if (!product.category) return true;

  const category = await Category.findById(product.category)
    .select('active isDeleted')
    .lean();

  if (!category) return true;
  if (category.isDeleted === true) return true;
  if (category.active === false) return true;

  return false; // ✅ product available
}
