import mongoose from "mongoose";
import Cart from "../models/cart.js";
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';
import { getBestOfferForProduct } from "../helpers/offerHelper.js";
import { isCategoryBlocked } from '../helpers/categoryGuard.js';


function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
// helper to fix image paths (local + cloudinary)
function resolveImage(img) {
  if (!img) return '/uploads/placeholder.png';
  if (typeof img === 'string' && img.startsWith('http')) return img;
  return '/' + img;
}


export const addToCart = async (req, res) => {
  try {
    console.log(" ========= ADD TO CART REQUEST =========");
    const userId = req.user?._id;
    const { productId, variantId, quantity = 1 } = req.body;


    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Please login to add items to cart"
      });
    }


    if (!mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid product or variant ID"
      });
    }


    const variant = await Variant.findById(variantId);
    const product = await Product.findById(productId)
  .select('status isDeleted category')
  .lean();

if (!product) {
  return res.status(404).json({
    ok: false,
    message: 'Product not found'
  });
}



if (
  product.isDeleted === true ||
  product.status === 'blocked' ||
  await isCategoryBlocked(product.category)
) {
  return res.status(400).json({
    ok: false,
    message: 'This product is currently unavailable'
  });
}

    if (!variant) {
      return res.status(404).json({
        ok: false,
        message: "Product variant not found"
      });
    }


    if (variant.stock === 0) {
      return res.status(400).json({
        ok: false,
        message: "This product is currently out of stock"
      });
    }

    if (variant.stock < quantity) {
      return res.status(400).json({
        ok: false,
        message: `Only ${variant.stock} items left in stock`
      });
    }
    //       if (existingIndex === -1 && cart.items.length >= 5) {
    //   return res.status(400).json({
    //     ok: false,
    //     message: "Maximum 5 different products allowed in cart"
    //   });
    // }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }


    const existingIndex = cart.items.findIndex(
      i => String(i.variant) === String(variantId)
    );


    if (existingIndex > -1) {

      const newQuantity = cart.items[existingIndex].quantity + Number(quantity);

     
      if (newQuantity > variant.stock) {
        return res.status(400).json({
          ok: false,
          message: `Cannot add more items. Only ${variant.stock} available in stock`
        });
      }

      cart.items[existingIndex].quantity = newQuantity;
    } else {
     

      cart.items.push({
        product: productId,
        variant: variantId,
        quantity: Number(quantity)
      });
    }
    // const qtyToAdd = Math.min(Number(quantity), MAX_QTY_PER_ITEM);

    await cart.save();


    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      ok: true,
      message: "Item added to cart",
      cartCount: cartCount
    });

  } catch (err) {
    console.error("addToCart error:", err);

    res.status(500).json({
      ok: false,
      message: "Server error. Please try again.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const viewCart = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.redirect("/auth/login?returnTo=/cart");
    }

    console.log(" Loading cart for user:", userId);


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

    console.log(" Cart data found:", !!cart);

    let items = [];
    let total = 0;
    let cartCount = 0;
    let outOfStockCount = 0;
    let blockedProductCount = 0;

    if (cart?.items?.length) {
      for (const i of cart.items) {
        const product = i.product || {};
        const variant = i.variant || {};


        const categoryBlocked = await isCategoryBlocked(product.category);

const isProductBlocked =
  product.status === 'blocked' ||
  product.isDeleted === true ||
  categoryBlocked;
        const isOutOfStock = variant.stock === 0 || isProductBlocked;
        const isProductAvailable = !isProductBlocked;


        let basePrice = 0;
        let discountAmount = 0;
        let finalPrice = 0;
        let offer = null;
        let subtotal = 0;

        if (isProductAvailable && !isOutOfStock) {
          basePrice = toNum(variant.salePrice) || toNum(variant.price) || 0;


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

        if (isOutOfStock) {
          outOfStockCount++;
        }

        if (isProductBlocked) {
          blockedProductCount++;
        }


        const image =
          resolveImage(
            variant?.images?.[0] ||
            product?.images?.[0]
          );

        items.push({
          productId: product._id,
          name: product.name || "Unknown Product",
          slug: product.slug,
          variantId: variant._id,
          color: variant.color || "Default",
          colorCode: variant.colorCode || "#808080",
          image,
          basePrice,
          finalPrice,
          discountAmount,
          offer,
          quantity: i.quantity,
          subtotal,
          stock: variant.stock || 0,
          isOutOfStock,
          isProductBlocked,
          productStatus: product.status || 'active',
          productDeleted: product.isDeleted || false
        });
      }
    }




    if (blockedProductCount > 0) {
      setTimeout(async () => {
        try {
          await Cart.updateOne(
            { user: userId },
            { $pull: { items: { product: { $in: items.filter(i => i.isProductBlocked).map(i => i.productId) } } } }
          );
        } catch (err) {
          console.error("Error cleaning blocked products:", err);
        }
      }, 1000);
    }

    return res.render("user/pages/cart", {
      pageTitle: "Your Shopping Cart",
      items,
      total,
      cartCount,
      cartEmpty: items.length === 0,
      hasOutOfStockItems: outOfStockCount > 0,
      hasBlockedProducts: blockedProductCount > 0,
      pageJs: "cart.js"
    });

  } catch (err) {
    console.error("viewCart error:", err);
    next(err);
  }
};

export const updateCartQty = async (req, res) => {
  try {
    const { variantId, quantity } = req.body;
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "Login required" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.json({ ok: false, message: "Cart not found" });

    const item = cart.items.find(i => String(i.variant) === String(variantId));
    if (!item) return res.json({ ok: false, message: "Item not found in cart" });


    const variant = await Variant.findById(variantId);
    if (!variant) {

      await Cart.updateOne(
        { user: userId },
        { $pull: { items: { variant: variantId } } }
      );
      return res.json({
        ok: false,
        message: "This item is no longer available"
      });
    }


    if (variant.stock === 0) {

      await Cart.updateOne(
        { user: userId },
        { $pull: { items: { variant: variantId } } }
      );
      return res.json({
        ok: false,
        message: "This product is out of stock and has been removed from your cart"
      });
    }


    if (variant.stock < quantity) {
      return res.json({
        ok: false,
        message: `Only ${variant.stock} items available`
      });
    }

    item.quantity = Math.max(1, Number(quantity));
    await cart.save();


    const itemPrice = toNum(variant.salePrice) || toNum(variant.price) || 0;
    const itemSubtotal = itemPrice * item.quantity;

    const cartTotal = cart.items.reduce((sum, item) => {
      const variantPrice = toNum(item.variant?.salePrice) || toNum(item.variant?.price) || 0;
      return sum + (variantPrice * item.quantity);
    }, 0);

    res.json({
      ok: true,
      subtotal: itemSubtotal,
      total: cartTotal,
      quantity: item.quantity,
      stock: variant.stock,
      isOutOfStock: variant.stock === 0
    });

  } catch (err) {
    console.error("updateCartQty error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};


export const removeFromCart = async (req, res) => {
  try {
    const { variantId } = req.body;
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "Login required" });
    }

    const result = await Cart.updateOne(
      { user: userId },
      { $pull: { items: { variant: variantId } } }
    );

    if (result.modifiedCount === 0) {
      return res.json({ ok: false, message: "Item not found in cart" });
    }

    res.json({ ok: true, message: "Item removed from cart" });

  } catch (err) {
    console.error("removeFromCart error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
};
export const removrAll =async (req,res) =>{
  try{
      const userId = req.user._id;
      let quary ={
        user:userId,
        
      }

      await Cart.findOneAndUpdate(
       {user:userId},
       {$set:{items:[]}}
      )

      res.redirect("/user/cart")
  }catch(err){
    console.log(err)
  }

}


export const getCartCount = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.json({ ok: true, cartCount: 0 });
    }

    const cart = await Cart.findOne({ user: userId });
    const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    res.json({ ok: true, cartCount });

  } catch (err) {
    console.error("getCartCount error:", err);
    res.json({ ok: true, cartCount: 0 });
  }
};
export const validateCheckout = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Login required'
      });
    }
   const product = await Product.find()
     const cart = await Cart.findOne({ user: userId })
  .populate({
    path: "items.product",
    populate: { path: "category" }
  })
  .populate("items.variant");

    if (!cart || cart.items.length === 0) {
      return res.json({
        ok: false,
        message: 'Your cart is empty'
      });
    }

    const errors = [];

    for (const item of cart.items) {
      const variant = item.variant;
         const product = item.product;
         const category = product.category;

      if (!variant) {
        errors.push('Some products are no longer available');
        continue;
      }
  if (category.active === false ) {
  errors.push(`${category.name} category is currently unavailable`);
  continue;
}
       if (product.status === "blocked" || product.isDeleted === true) {
        errors.push(`${product.name} is currently unavailable`);
        continue;
      }

      if (variant.stock < item.quantity) {
        errors.push(
          `${variant.color || 'Product'} stock reduced. Available: ${variant.stock}`
        );
      }
    }

    if (errors.length > 0) {
      return res.json({
        ok: false,
        message: 'Stock changed',
        errors
      });
    }

  
    return res.json({ ok: true });

  } catch (err) {
    console.error('validateCheckout error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};