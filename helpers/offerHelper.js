import mongoose from 'mongoose';
import Offer from '../models/offer.js';

export async function getBestOfferForProduct({ _id, category, price }) {
  const now = new Date();

  const productId =
    mongoose.Types.ObjectId.isValid(_id)
      ? new mongoose.Types.ObjectId(_id)
      : null;

  const categoryId =
    mongoose.Types.ObjectId.isValid(category)
      ? new mongoose.Types.ObjectId(category)
      : null;

  const offers = [];

  if (productId) {
    const productOffer = await Offer.findOne({
      type: 'product',
      targetId: productId,
      isActive: true,
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();

    if (productOffer) offers.push(productOffer);
  }

  if (categoryId) {
    const categoryOffer = await Offer.findOne({
      type: 'category',
      targetId: categoryId,
      isActive: true,
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();

    if (categoryOffer) offers.push(categoryOffer);
  }

  if (!offers.length) return null;

  const basePrice = Number(price) || 0;

  return offers.reduce((best, curr) => {
    const bestDiscount =
      best.discountType === 'percentage'
        ? (basePrice * best.discountValue) / 100
        : best.discountValue;

    const currDiscount =
      curr.discountType === 'percentage'
        ? (basePrice * curr.discountValue) / 100
        : curr.discountValue;

    if (currDiscount === bestDiscount) {
      return (curr.priority || 0) > (best.priority || 0) ? curr : best;
    }

    return currDiscount > bestDiscount ? curr : best;
  });
}
