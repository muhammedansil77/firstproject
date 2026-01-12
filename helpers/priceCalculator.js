// Create a new file: services/priceCalculator.js
import { getBestOfferForProduct } from '../helpers/offerHelper';

export class PriceCalculator {
  static async calculateCartTotals(cart, calculateIndividualItems = true) {
    let subtotal = 0;
    let totalDiscount = 0;
    let originalSubtotal = 0;
    const items = [];
    
    for (const cartItem of cart.items) {
      const variant = cartItem.variant;
      const product = cartItem.product;
      const basePrice = variant.salePrice || variant.price || 0;
      
      // Get offer for this product
      const offer = await getBestOfferForProduct({
        _id: product._id,
        category: product.category,
        price: basePrice
      });
      
      // Calculate discount
      let discount = 0;
      let finalPrice = basePrice;
      
      if (offer) {
        discount = offer.discountType === 'percentage' 
          ? (basePrice * offer.discountValue) / 100
          : offer.discountValue;
        
        if (offer.maxDiscountAmount) {
          discount = Math.min(discount, offer.maxDiscountAmount);
        }
        
        finalPrice = Math.max(basePrice - discount, 0);
      }
      
      const itemTotal = finalPrice * cartItem.quantity;
      const originalItemTotal = basePrice * cartItem.quantity;
      
      subtotal += itemTotal;
      originalSubtotal += originalItemTotal;
      totalDiscount += (discount * cartItem.quantity);
      
      items.push({
        product: product._id,
        variant: variant._id,
        quantity: cartItem.quantity,
        basePrice,
        discountPerUnit: discount,
        finalPrice,
        itemTotal,
        originalItemTotal,
        offer: offer ? offer._id : null
      });
    }
    
    const tax = subtotal * 0.10;
    const shipping = subtotal >= 500 ? 0 : 50;
    const finalAmount = subtotal + tax + shipping;
    
    return {
      items,
      subtotal,
      originalSubtotal,
      totalDiscount,
      tax,
      shipping,
      finalAmount,
      summary: {
        itemCount: cart.items.length,
        savings: totalDiscount,
        savingsPercentage: originalSubtotal > 0 
          ? (totalDiscount / originalSubtotal * 100).toFixed(2) 
          : 0
      }
    };
  }
  static async calculateItemPrice({ product, variant }) {
    const basePrice = variant.salePrice || variant.price || 0;

    const offer = await getBestOfferForProduct({
      _id: product._id,
      category: product.category,
      price: basePrice
    });

    let discount = 0;
    let finalPrice = basePrice;

    if (offer) {
      discount = offer.discountType === 'percentage'
        ? (basePrice * offer.discountValue) / 100
        : offer.discountValue;

      if (offer.maxDiscountAmount) {
        discount = Math.min(discount, offer.maxDiscountAmount);
      }

      finalPrice = Math.max(basePrice - discount, 0);
    }

    return {
      basePrice,
      finalPrice,
      discount,
      offer
    };
  }
  
}