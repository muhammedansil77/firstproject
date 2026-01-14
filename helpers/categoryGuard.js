import mongoose from 'mongoose';
import Category from '../models/Category.js';

export async function isCategoryBlocked(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return true; // invalid category = block
  }

  const category = await Category.findById(categoryId)
    .select('active isDeleted')
    .lean();

  if (!category) return true;
  if (category.isDeleted === true) return true;
  if (category.active === false) return true;

  return false;
}
