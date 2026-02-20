import mongoose from "mongoose";
import Cart from "../models/cart.js";
import Category  from "../models/Category.js";
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';
import { getBestOfferForProduct } from "../helpers/offerHelper.js";
import { isCategoryBlocked } from '../helpers/categoryGuard.js';
import { viewCartService,
  updateCartQtyService  
 } from "../services/user/cartService.js";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

export const viewCart = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.redirect("/auth/login?returnTo=/cart");
    }

    const result = await viewCartService(userId);

    return res.render("user/pages/cart", {
      pageTitle: "Your Shopping Cart",
      items: result.items,
      total: result.total,
      cartCount: result.cartCount,
      cartEmpty: result.items.length === 0,
      hasOutOfStockItems: result.outOfStockCount > 0,
      hasBlockedProducts: result.blockedProductCount > 0,
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
    const userId = req.user?._id;

    const result = await updateCartQtyService(
      userId,
      variantId,
      quantity
    );

    if (result.status) {
      return res.status(result.status).json(result);
    }

    return res.json(result);

  } catch (err) {
    console.error("updateCartQty error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error"
    });
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