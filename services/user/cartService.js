import mongoose from "mongoose";
import Cart from "../../models/cart.js";
import Category  from "../../models/Category.js";
import Product from '../../models/Product.js';
import Variant from '../../models/Variant.js';
import { getBestOfferForProduct } from "../../helpers/offerHelper.js";
import { isCategoryBlocked } from '../../helpers/categoryGuard.js';


function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveImage(img) {
  if (!img) return '/uploads/placeholder.png';
  if (typeof img === 'string' && img.startsWith('http')) return img;
  return '/' + img;
}
export const viewCartService = async (userId) => {

  const cart = await Cart.findOne({ user: userId })
    .populate({
      path: "items.product",
      select: "name images slug category status isDeleted"
    })
    .populate({
      path: "items.variant",
      select: "color colorCode images price salePrice stock"
    })
    .lean();

  if (!cart || !cart.items?.length) {
    return {
      items: [],
      total: 0,
      cartCount: 0,
      outOfStockCount: 0,
      blockedProductCount: 0
    };
  }

  let items = [];
  let total = 0;
  let cartCount = 0;
  let outOfStockCount = 0;
  let blockedProductIds = [];

  for (const i of cart.items) {
    const product = i.product || {};
    const variant = i.variant || {};

    const categoryBlocked = await isCategoryBlocked(product.category);

    const isProductBlocked =
      product.status === "blocked" ||
      product.isDeleted === true ||
      categoryBlocked;

    const isOutOfStock = variant.stock === 0 || isProductBlocked;
    const isAvailable = !isProductBlocked && !isOutOfStock;

    let basePrice = 0;
    let discountAmount = 0;
    let finalPrice = 0;
    let offer = null;
    let subtotal = 0;

    if (isAvailable) {
      basePrice = toNum(variant.salePrice) || toNum(variant.price);

      offer = await getBestOfferForProduct({
        _id: product._id,
        category: product.category,
        price: basePrice
      });

      if (offer) {
        discountAmount =
          offer.discountType === "percentage"
            ? (basePrice * offer.discountValue) / 100
            : offer.discountValue;

        if (offer.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, offer.maxDiscountAmount);
        }

        finalPrice = basePrice - discountAmount;
      } else {
        finalPrice = basePrice;
      }

      subtotal = finalPrice * i.quantity;
      total += subtotal;
      cartCount += i.quantity;
    }

    if (isOutOfStock) outOfStockCount++;
    if (isProductBlocked) blockedProductIds.push(product._id);

    items.push({
      productId: product._id,
      name: product.name || "Unknown Product",
      slug: product.slug,
      variantId: variant._id,
      color: variant.color || "Default",
      colorCode: variant.colorCode || "#808080",
      image: resolveImage(
        variant?.images?.[0] || product?.images?.[0]
      ),
      basePrice,
      finalPrice,
      discountAmount,
      offer,
      quantity: i.quantity,
      subtotal,
      stock: variant.stock || 0,
      isOutOfStock,
      isProductBlocked,
      productStatus: product.status || "active",
      productDeleted: product.isDeleted || false
    });
  }

  // Cleanup blocked products immediately (no setTimeout hack)
  if (blockedProductIds.length > 0) {
    await Cart.updateOne(
      { user: userId },
      { $pull: { items: { product: { $in: blockedProductIds } } } }
    );
  }

  return {
    items,
    total,
    cartCount,
    outOfStockCount,
    blockedProductCount: blockedProductIds.length
  };
};
export const updateCartQtyService = async (userId, variantId, quantity) => {

  if (!userId) {
    return { ok: false, status: 401, message: "Login required" };
  }

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return { ok: false, message: "Cart not found" };
  }

  const item = cart.items.find(
    i => String(i.variant) === String(variantId)
  );

  if (!item) {
    return { ok: false, message: "Item not found in cart" };
  }

  const variant = await Variant.findById(variantId);

  if (!variant) {
    await Cart.updateOne(
      { user: userId },
      { $pull: { items: { variant: variantId } } }
    );

    return {
      ok: false,
      message: "This item is no longer available",
      removed: true
    };
  }

  if (variant.stock === 0) {
    await Cart.updateOne(
      { user: userId },
      { $pull: { items: { variant: variantId } } }
    );

    return {
      ok: false,
      message: "This product is out of stock and has been removed from your cart",
      removed: true
    };
  }

  if (variant.stock < quantity) {
    return {
      ok: false,
      message: `Only ${variant.stock} items available`,
      stock: variant.stock
    };
  }

  // Update quantity safely
  item.quantity = Math.max(1, Number(quantity));
  await cart.save();

  const itemPrice =
    toNum(variant.salePrice) || toNum(variant.price);

  const itemSubtotal = itemPrice * item.quantity;


  let cartTotal = 0;

  for (const cartItem of cart.items) {
    const v = await Variant.findById(cartItem.variant);
    if (v) {
      const price = toNum(v.salePrice) || toNum(v.price);
      cartTotal += price * cartItem.quantity;
    }
  }

  return {
    ok: true,
    subtotal: itemSubtotal,
    total: cartTotal,
    quantity: item.quantity,
    stock: variant.stock,
    isOutOfStock: variant.stock === 0
  };
};