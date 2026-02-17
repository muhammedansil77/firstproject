
import Address from "../models/Address.js";
import RefundRequest from "../models/RefundRequest.js";
import Cart from "../models/cart.js";
import Order from "../models/Order.js";
import Variant from "../models/Variant.js";
import User from "../models/userSchema.js";
import mongoose from "mongoose";
import Wallet from '../models/Wallet.js'
import { getBestOfferForProduct } from "../helpers/offerHelper.js";
import Coupon from "../models/Coupon.js";
import PDFDocument from 'pdfkit';
import { isCategoryBlocked } from "../helpers/categoryGuard.js";
import { isProductUnavailable } from "../helpers/productAvailability.js";



import Razorpay from "razorpay";
import crypto from "crypto";
function distributeCoupon(cartItems, totalCouponDiscount) {
  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.total,
    0
  );

  return cartItems.map(item => {
    const share = item.total / cartSubtotal;
    const discount = Number((totalCouponDiscount * share).toFixed(2));

    return {
      ...item,
      couponDiscount: discount
    };
  });
}
function resolveImage(img) {
  if (!img) return '/uploads/placeholder.png';
  if (typeof img === 'string' && img.startsWith('http')) return img; // cloudinary
  return '/' + img; // local uploads
}

let razorpayInstance;

try {

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('Razorpay initialized successfully');
  } else {
    console.warn(' Razorpay keys not configured in environment variables');

    razorpayInstance = {
      orders: {
        create: async (options) => {
          console.log(' Mock: Creating Razorpay order for ₹' + (options.amount / 100));
          return {
            id: 'mock_order_' + Date.now(),
            amount: options.amount,
            currency: options.currency || 'INR',
            receipt: options.receipt,
            status: 'created'
          };
        }
      },
      payments: {
        fetch: async (paymentId) => {
          console.log(' Mock: Fetching payment:', paymentId);
          return {
            id: paymentId,
            amount: 2200000,
            currency: 'INR',
            status: 'captured'
          };
        }
      }
    };

  }
} catch (error) {
  console.error(' Failed to initialize Razorpay:', error);

  razorpayInstance = {
    orders: {
      create: async () => {
        throw new Error('Razorpay not initialized');
      }
    }
  };
}


const razorpay = razorpayInstance;




export const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { couponCode } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to apply coupon"
      });
    }

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required"
      });
    }



    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name category"
      })
      .populate({
        path: "items.variant",
        select: "price salePrice stock"
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }


    let subtotal = 0;
    const cartItems = [];

    for (const cartItem of cart.items) {
      const variant = cartItem.variant;
      const product = cartItem.product;



      if (!variant) continue;

      const basePrice = variant.salePrice || variant.price || 0;

      let offer = null;
      let finalPrice = basePrice;

      if (product && product._id) {
        offer = await getBestOfferForProduct({
          _id: product._id,
          category: product.category,
          price: basePrice
        });

        if (offer) {
          let discount =
            offer.discountType === "percentage"
              ? (basePrice * offer.discountValue) / 100
              : offer.discountValue;

          if (offer.maxDiscountAmount) {
            discount = Math.min(discount, offer.maxDiscountAmount);
          }

          finalPrice = Math.max(basePrice - discount, 0);
        }
      }

      const itemTotal = finalPrice * cartItem.quantity;
      subtotal += itemTotal;

      cartItems.push({
        productId: product?._id,
        categoryId: product?.category,
        price: finalPrice,
        quantity: cartItem.quantity,
        total: itemTotal
      });
    }


    const tax = subtotal * 0.10;
    const shipping = subtotal >= 500 ? 0 : 50;
    const totalAmount = subtotal + tax + shipping;
    if (req.session.appliedCoupon?.code === couponCode.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: "Coupon already applied"
      });
    }


    const validationResult = await Coupon.validateCoupon(couponCode, userId, totalAmount);

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message
      });
    }

    const coupon = validationResult.coupon;


    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      const applicableProductIds = coupon.applicableProducts.map(id => id.toString());
      const hasApplicableProduct = cartItems.some(item =>
        applicableProductIds.includes(item.productId?.toString())
      );

      if (!hasApplicableProduct) {
        return res.status(400).json({
          success: false,
          message: "Coupon is not applicable to items in your cart"
        });
      }
    }

    if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
      const applicableCategoryIds = coupon.applicableCategories.map(id => id.toString());
      const hasApplicableCategory = cartItems.some(item =>
        item.categoryId && applicableCategoryIds.includes(item.categoryId.toString())
      );

      if (!hasApplicableCategory) {
        return res.status(400).json({
          success: false,
          message: "Coupon is not applicable to categories in your cart"
        });
      }
    }
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
    } else {
      discount = coupon.discountValue;
    }
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }
    discount = Math.min(discount, subtotal);

    const finalAmount = subtotal - discount + tax + shipping;


    req.session.appliedCoupon = {
      code: coupon.code,
      discount: discount,
      couponId: coupon._id,
      timestamp: Date.now()
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      } else {
        console.log(' Session saved with coupon:', req.session.appliedCoupon);
      }
    });

    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: discount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        minPurchaseAmount: coupon.minPurchaseAmount,
        maxDiscountAmount: coupon.maxDiscountAmount
      }
    });

  } catch (error) {
    console.error("Apply Coupon Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error applying coupon"
    });
  }
};

export const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to remove coupon"
      });
    }
    delete req.session.appliedCoupon;


    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name category"
      })
      .populate({
        path: "items.variant",
        select: "price salePrice stock"
      });

    if (!cart || cart.items.length === 0) {
      return res.json({
        success: true,
        message: "Coupon removed",
        data: {
          subtotal: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
          finalAmount: 0
        }
      });
    }
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const variant = cartItem.variant;
      const product = cartItem.product;

      if (!variant) continue;

      const basePrice = variant.salePrice || variant.price || 0;

      let finalPrice = basePrice;

      if (product && product._id) {
        const offer = await getBestOfferForProduct({
          _id: product._id,
          category: product.category,
          price: basePrice
        });

        if (offer) {
          let discount =
            offer.discountType === "percentage"
              ? (basePrice * offer.discountValue) / 100
              : offer.discountValue;

          if (offer.maxDiscountAmount) {
            discount = Math.min(discount, offer.maxDiscountAmount);
          }

          finalPrice = Math.max(basePrice - discount, 0);
        }
      }

      subtotal += finalPrice * cartItem.quantity;
    }

    const tax = subtotal * 0.10;
    const shipping = subtotal >= 500 ? 0 : 50;
    const finalAmount = subtotal + tax + shipping;

    res.json({
      success: true,
      message: "Coupon removed successfully",
      data: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: 0,
        finalAmount: finalAmount.toFixed(2)
      }
    });

  } catch (error) {
    console.error("Remove Coupon Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error removing coupon"
    });
  }
};
export const createRazorpayOrder = async (req, res) => {
    let cart;
  try {
    const userId = req.session.userId;
      const { addressId } = req.body;
 

    console.log(' Creating Razorpay order for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue"
      });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name category"
      })
      .populate({
        path: "items.variant",
        select: "price salePrice stock"
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }
    for (const cartItem of cart.items) {
  const updatedVariant = await Variant.findOneAndUpdate(
    { _id: cartItem.variant._id, stock: { $gte: cartItem.quantity } },
    { $inc: { stock: -cartItem.quantity } },
    { new: true }
  );

  if (!updatedVariant) {
    return res.status(400).json({
      success: false,
      message: `Out of stock for ${cartItem.product.name}`
    });
  }
}

    let subtotal = 0;

    for (const cartItem of cart.items) {
      const variant = cartItem.variant;
      const product = cartItem.product;
      

      if (!variant) continue;
      

      const basePrice = variant.salePrice || variant.price || 0;

      const offer = await getBestOfferForProduct({
        _id: product._id,
        category: product.category,
        price: basePrice
      });

      let finalPrice = basePrice;

      if (offer) {
        let offerDiscount =
          offer.discountType === "percentage"
            ? (basePrice * offer.discountValue) / 100
            : offer.discountValue;

        if (offer.maxDiscountAmount) {
          offerDiscount = Math.min(offerDiscount, offer.maxDiscountAmount);
        }

        finalPrice = Math.max(basePrice - offerDiscount, 0);
      }

      subtotal += finalPrice * cartItem.quantity;
    }
    const tax = subtotal * 0.10;
    const shipping = subtotal >= 500 ? 0 : 50;


    let discount = 0;

    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon.code,
        isActive: true,
        isDeleted: false
      });

      if (coupon && coupon.isValid(userId)) {
        if (coupon.discountType === "percentage") {
          discount = (subtotal * coupon.discountValue) / 100;
        } else {
          discount = coupon.discountValue;
        }

        if (coupon.maxDiscountAmount) {
          discount = Math.min(discount, coupon.maxDiscountAmount);
        }

        discount = Math.min(discount, subtotal);
      }
    }
    const cartTotal = subtotal - discount + tax + shipping;
    
const finalAmount = cartTotal;

    if (cartTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payable amount after discount"
      });
    }
    const amountInPaise = Math.round(cartTotal * 100);

    if (amountInPaise < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount for online payment is ₹1"
      });
    }
    
if (!addressId) {
  return res.status(400).json({
    success: false,
    message: "Address required"
  });
}

const address = await Address.findOne({ _id: addressId, userId });
if (!address) {
  return res.status(404).json({ success: false });
}

const internalOrder = await Order.create({
  user: userId,
  address: {
    fullName: address.fullName,
    phone: address.phone,
    house: address.addressLine1,
    city: address.city,
    state: address.state,
    pincode: address.postalCode,
    country: address.country || "India"
  },
 items: cart.items.map(item => ({
  orderItemId: new mongoose.Types.ObjectId().toString(), // ✅ present
  product: item.product._id,
  variant: item.variant._id,
  quantity: item.quantity,
  price: item.variant.salePrice || item.variant.price,
  total: (item.variant.salePrice || item.variant.price) * item.quantity
}))
,
  subtotal,
  tax,
  shipping,
  discount,
  finalAmount,
  paymentMethod: "Razorpay",
  paymentStatus: "Pending",
  orderStatus: "Pending Payment"
});

const razorpayOrder = await razorpay.orders.create({
  amount: Math.round(finalAmount * 100),
  currency: "INR",
  receipt: internalOrder._id.toString()
});

internalOrder.razorpayOrderId = razorpayOrder.id;
await internalOrder.save();



  return res.json({
  success: true,
  message: "Razorpay order created successfully",
  data: {
    id: razorpayOrder.id,
    internalOrderId: internalOrder._id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key_id: process.env.RAZORPAY_KEY_ID
  }
});


  } catch (error) {
    console.error(" Razorpay order creation error:", error);
     if (cart && cart.items) {
      for (const cartItem of cart.items) {
        await Variant.findByIdAndUpdate(cartItem.variant._id, {
          $inc: { stock: cartItem.quantity }
        });
      }
    }


    return res.status(500).json({
      success: false,
      message: error.error?.description || error.message || "Error creating Razorpay order"
    });
  }
};

export const markPaymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false });
    }
      for (const item of order.items) {
      await Variant.findByIdAndUpdate(item.variant, {
        $inc: { stock: item.quantity }
      });
    }

    order.paymentStatus = "Failed";
    order.orderStatus = "Pending Payment";
     order.orderStatus = "Cancelled";

    order.statusHistory.push({
      status: "Payment Failed",
      changedAt: new Date(),
      notes: "Razorpay payment failed or cancelled",
      changedBy: order.user
    });

    await order.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Payment failed update error:", err);
    res.status(500).json({ success: false });
  }
};

export const verifyRazorpayPayment = async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login"
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      user: userId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.paymentStatus === "Paid") {
      return res.json({
        success: true,
        message: "Payment already processed",
        orderId: order._id
      });
    }

    order.paymentStatus = "Paid";
    order.orderStatus = "Placed";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;

    order.statusHistory.push({
      status: "Payment Success",
      changedAt: new Date(),
      notes: "Razorpay payment successful",
      changedBy: userId
    });

    await order.save();

    // ✅ Reduce stock ONLY NOW
    for (const item of order.items) {
      await Variant.findByIdAndUpdate(
        item.variant,
        { $inc: { stock: -item.quantity } }
      );
    }

    // ✅ Clear cart
    await Cart.deleteOne({ user: userId });

    return res.json({
      success: true,
      message: "Payment successful",
      orderId: order._id
    });

  } catch (error) {
    console.error("Verify Razorpay Error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
};



async function createOrderAfterPayment(userId, addressId, paymentMethod, paymentDetails) {
  const cart = await Cart.findOne({ user: userId })
    .populate("items.product")
    .populate("items.variant");

  const address = await Address.findById(addressId);

  const createdOrders = [];

  for (const cartItem of cart.items) {
    const basePrice = cartItem.variant.salePrice || cartItem.variant.price;

    const offer = await getBestOfferForProduct({
      _id: cartItem.product._id,
      category: cartItem.product.category,
      price: basePrice
    });

    let finalPrice = basePrice;
    if (offer) {
      let discount =
        offer.discountType === "percentage"
          ? (basePrice * offer.discountValue) / 100
          : offer.discountValue;

      if (offer.maxDiscountAmount) {
        discount = Math.min(discount, offer.maxDiscountAmount);
      }
      finalPrice = Math.max(basePrice - discount, 0);
    }

    const itemTotal = finalPrice * cartItem.quantity;
    const tax = itemTotal * 0.10;
    const shipping = itemTotal >= 500 ? 0 : 50;
    const finalAmount = itemTotal + tax + shipping;

    const order = await Order.create({
      user: userId,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        house: address.addressLine1,
        city: address.city,
        state: address.state,
        pincode: address.postalCode,
        country: "India"
      },
      items: [{
        product: cartItem.product._id,
        variant: cartItem.variant._id,
        quantity: cartItem.quantity,
        price: finalPrice,
        total: itemTotal
      }],
      subtotal: itemTotal,
      tax,
      shipping,
      discount: 0,
      finalAmount,
      paymentMethod,
      paymentStatus: "Paid",
      orderStatus: "Placed",
      razorpayOrderId: paymentDetails.razorpay_order_id,
      razorpayPaymentId: paymentDetails.razorpay_payment_id
    });

    order.orderNumber = `ORD-${order._id.toString().slice(-8).toUpperCase()}`;
    await order.save();

    await Variant.findByIdAndUpdate(
      cartItem.variant._id,
      { $inc: { stock: -cartItem.quantity } }
    );

    createdOrders.push(order);
  }

  await Cart.deleteOne({ user: userId });

  return {
    success: true,
    orderId: createdOrders[0]._id,
    orderNumber: createdOrders[0].orderNumber
  };
}

export const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.userId;
    delete req.session.appliedCoupon;

    if (!userId) {
      req.flash("error", "Please login to continue");
      return res.redirect("/login");
    }
    const user = await User.findById(userId).select("fullName email phone");
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }
    let walletBalance = 0;
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        transactions: []
      });
    }

    walletBalance = Number(wallet.balance) || 0;
const availableCoupons = await Coupon.find({
  isActive: true,
  isDeleted: false,
  startDate: { $lte: new Date() },
  endDate: { $gte: new Date() }
}).lean();

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name slug description category"
      })
      .populate({
        path: "items.variant",
        select: "-__v"
      });

    if (!cart || cart.items.length === 0) {
      req.flash("error", "Your cart is empty");
      return res.redirect("/cart");
    }

    const validItems = cart.items.filter(item =>
      item.variant !== null &&
      item.variant.isListed === true
    );

    if (validItems.length === 0) {
      req.flash("error", "Some products in your cart are no longer available");
      return res.redirect("/cart");
    }

    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    let subtotal = 0;
    const cartItems = [];

    for (const item of validItems) {
      const basePrice = item.variant.salePrice || item.variant.price || 0;

      let offer = null;
      let finalPrice = basePrice;

      if (item.product && item.product._id) {
        offer = await getBestOfferForProduct({
          _id: item.product._id,
          category: item.product.category,
          price: basePrice
        });

        if (offer) {
          let discount =
            offer.discountType === "percentage"
              ? (basePrice * offer.discountValue) / 100
              : offer.discountValue;

          if (offer.maxDiscountAmount) {
            discount = Math.min(discount, offer.maxDiscountAmount);
          }

          finalPrice = Math.max(basePrice - discount, 0);
        }
      }

      const itemTotal = finalPrice * item.quantity;
      subtotal += itemTotal;

      cartItems.push({
        product: item.product || { name: "Product" },
        variant: item.variant,
        quantity: item.quantity,
        basePrice: basePrice,
        price: finalPrice,
        itemTotal: itemTotal,
        offer: offer
      });
    }

    const tax = subtotal * 0.10;
    const shipping = subtotal >= 500 ? 0 : 50;

    let discount = 0;
    let couponData = null;

    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon.code,
        isActive: true,
        isDeleted: false
      });
      if (coupon && coupon.isValid(userId)) {
        console.log(' Coupon is valid');

        if (coupon.discountType === 'percentage') {
          discount = (subtotal * coupon.discountValue) / 100;
        } else {
          discount = coupon.discountValue;
        }

        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
          discount = coupon.maxDiscountAmount;
        }

        discount = Math.min(discount, subtotal);

        couponData = {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: discount
        };

      } else {
        console.log(' Coupon invalid or expired, clearing from session');
        delete req.session.appliedCoupon;
      }
    } else {
      console.log('No coupon in session');
    }

    const finalAmount = subtotal + tax + shipping - discount;
    res.render("user/pages/checkout", {
      cartItems,
      addresses,
        availableCoupons,

      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discount: discount.toFixed(2),
      shipping: shipping.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
      walletBalance: walletBalance,
      appliedCoupon: couponData,
      pageJs: "order.js",
      userName: user.fullName,
      userEmail: user.email,
      userPhone: user.phone,
      user: user
    });
  } catch (error) {
    console.error("Checkout Load Error:", error);
    req.flash("error", "Error loading checkout page");
    res.redirect("/cart");
  }
};


export const getAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to view address"
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      userId
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    res.json({
      success: true,
      message: "Address fetched successfully",
      data: address
    });
  } catch (error) {
    console.error("Get Address Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching address"
    });
  }
};


export const createAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      addressType,
      isDefault
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add address"
      });
    }


    if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields"
      });
    }

    if (isDefault) {
      await Address.updateMany(
        { userId, isDefault: true },
        { isDefault: false }
      );
    }

    const address = await Address.create({
      userId,
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2 || "",
      city,
      state,
      postalCode,
      country: country || "India",
      addressType: addressType || "home",
      isDefault: isDefault || false
    });

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: address
    });
  } catch (error) {
    console.error("Create Address Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to update address"
      });
    }
    const address = await Address.findOne({
      _id: addressId,
      userId
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    if (updates.isDefault === true) {
      await Address.updateMany(
        { userId, _id: { $ne: addressId } },
        { isDefault: false }
      );
    }


    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'userId' && key !== '__v') {
        address[key] = updates[key];
      }
    });

    await address.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      data: address
    });
  } catch (error) {
    console.error("Update Address Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to delete address"
      });
    }

    const address = await Address.findOneAndDelete({
      _id: addressId,
      userId
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }


    if (address.isDefault) {
      const newDefault = await Address.findOne({ userId }).sort({ createdAt: 1 });
      if (newDefault) {
        newDefault.isDefault = true;
        await newDefault.save();
      }
    }

    res.json({
      success: true,
      message: "Address deleted successfully"
    });
  } catch (error) {
    console.error("Delete Address Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting address"
    });
  }
};


export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { addressId, paymentMethod, validateOnly, fromPayment } = req.body;

   
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue"
      });
    }

   
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: "Address required"
      });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

 
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart empty"
      });
    }
  // .populate({
  //   path: "items.product",
  //   populate: { path: "category" }
  // })
  
    if (validateOnly === true) {
      for (const item of cart.items) {
        const product = item.product;
        const variant = item.variant;

        if (!product || product.isDeleted || product.status === "blocked") {
          return res.status(400).json({
            success: false,
            type: "STOCK_CHANGED",
            message: `${product?.name || "Product"} is no longer available`
          });
        }

        if (!variant || variant.isListed === false) {
          return res.status(400).json({
            success: false,
            type: "STOCK_CHANGED",
            message: `${product?.name} variant is unavailable`
          });
        }

        if (variant.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            type: "STOCK_CHANGED",
            message: `Only ${variant.stock} item(s) left for ${product?.name}`
          });
        }
      }

      return res.json({
        success: true,
        message: "Order validation successful"
      });
    }

    if (
      paymentMethod === "Razorpay" &&
      !req.razorpayPayment &&
      fromPayment !== true
    ) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment not verified"
      });
    }

 
    let coupon = null;

    if (req.session.appliedCoupon) {
      coupon = await Coupon.findOne({
        code: req.session.appliedCoupon.code,
        isActive: true,
        isDeleted: false
      });
    }

    if (req.session.appliedCoupon && !coupon) {
      delete req.session.appliedCoupon;
      return res.status(400).json({
        success: false,
        message: "This coupon has been disabled by admin"
      });
    }

    if (coupon) {
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        delete req.session.appliedCoupon;
        return res.status(400).json({
          success: false,
          message: "This coupon has reached its usage limit"
        });
      }

      const userUsage = coupon.usersUsed.filter(
        u => u.user.toString() === userId.toString()
      ).length;

      if (coupon.perUserLimit > 0 && userUsage >= coupon.perUserLimit) {
        delete req.session.appliedCoupon;
        return res.status(400).json({
          success: false,
          message: "You have already used this coupon"
        });
      }
    }

  
    let paymentStatus =
      paymentMethod === "COD" ? "Pending" : "Paid";


    const createdOrders = [];
    let totalCouponDiscount = 0;
    let eligibleSubtotal = 0;

    if (coupon) {
      eligibleSubtotal = cart.items.reduce((sum, item) => {
        const price = item.variant.salePrice || item.variant.price;
        return sum + price * item.quantity;
      }, 0);

      if (eligibleSubtotal >= coupon.minPurchaseAmount) {
        totalCouponDiscount =
          coupon.discountType === "percentage"
            ? (eligibleSubtotal * coupon.discountValue) / 100
            : coupon.discountValue;

        if (coupon.maxDiscountAmount) {
          totalCouponDiscount = Math.min(
            totalCouponDiscount,
            coupon.maxDiscountAmount
          );
        }
      }
    }

    let remainingDiscount = totalCouponDiscount;

    for (const item of cart.items) {
      const product = item.product;
      const variant = item.variant;

      const updatedVariant = await Variant.findOneAndUpdate(
  { _id: variant._id, stock: { $gte: item.quantity } },
  { $inc: { stock: -item.quantity } },
  { new: true }
);

if (!updatedVariant) {
  throw new Error(`Only few stock left for ${product.name}`);
}


      let price = variant.salePrice || variant.price;
      let discount = 0;

      if (remainingDiscount > 0 && eligibleSubtotal > 0) {
        const share = (price * item.quantity) / eligibleSubtotal;
        discount = Math.min(
          Number((totalCouponDiscount * share).toFixed(2)),
          remainingDiscount
        );
        remainingDiscount -= discount;
      }

      const subtotal = price * item.quantity;
      const tax = subtotal * 0.1;
      const shipping = subtotal >= 500 ? 0 : 50;
      const finalAmount = subtotal + tax + shipping - discount;

      const order = await Order.create({
        user: userId,
        address: {
          fullName: address.fullName,
          phone: address.phone,
          house: address.addressLine1,
          city: address.city,
          state: address.state,
          pincode: address.postalCode,
          country: address.country
        },
        items: [{
            orderItemId: new mongoose.Types.ObjectId().toString(), 
          product: product._id,
          variant: variant._id,
          quantity: item.quantity,
          price,
          total: subtotal,
          itemStatus: "Placed"
        }],
        subtotal,
        tax,
        discount,
        shipping,
        finalAmount,
        paymentMethod,
        paymentStatus,
        orderStatus: "Placed",
        coupon: coupon?._id
      });

      order.orderNumber = `ORD-${order._id.toString().slice(-8).toUpperCase()}`;
      await order.save();

    

      createdOrders.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
         finalAmount: order.finalAmount 
      });
    }

   
   if (paymentMethod === "Wallet") {
  const wallet = await Wallet.findOne({ user: userId });

  const totalPayAmount = createdOrders.reduce((sum, o) => sum + o.finalAmount, 0);

  if (!wallet || wallet.balance < totalPayAmount) {
    throw new Error("Insufficient wallet balance");
  }

  wallet.balance -= totalPayAmount;
  await wallet.save();
}


 
    if (coupon) {
      await Coupon.updateOne(
        { _id: coupon._id },
        {
          $inc: { usedCount: 1 },
          $push: { usersUsed: { user: userId, usedAt: new Date() } }
        }
      );
    }

    await Cart.deleteOne({ user: userId });
    delete req.session.appliedCoupon;

    return res.json({
      success: true,
      orderId: createdOrders[0].orderId,
      allOrders: createdOrders,
      message: "Order placed successfully"
    });

  } catch (error) {
    console.error("Place Order Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Order failed. Please try again."
    });
  }
};




export const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = req.params.orderId;

    if (!userId) {
      req.flash("error", "Please login to view order");
      return res.redirect("/login");
    }


    const user = await User.findById(userId).select("fullName email");

    const order = await Order.findById(orderId)
      .populate("items.product", "name images")
      .populate("items.variant", "size color");

    if (!order || order.user.toString() !== userId) {
      return res.redirect("/");
    }

    res.render("user/pages/orderSuccess", {
      order,
      orderId: order._id,
      orderNumber: `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      userName: user.fullName
    });
  } catch (error) {
    console.error("Order Success Error:", error);
    res.redirect("/");
  }
};





pageJs: "allorder.js"



