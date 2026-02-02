
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



    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: internalOrder.orderNumber,
      payment_capture: 1
    });
    internalOrder.razorpayOrderId = order.id;
await internalOrder.save();
    return res.json({
      success: true,
      message: "Razorpay order created successfully",
      data: {
        id: order.id,
         internalOrderId: internalOrder._id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (error) {
    console.error(" Razorpay order creation error:", error);

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

    order.paymentStatus = "Failed";
    order.orderStatus = "Pending Payment";

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

      if (variant.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
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

      await Variant.findByIdAndUpdate(
        variant._id,
        { $inc: { stock: -item.quantity } }
      );

      createdOrders.push({
        orderId: order._id,
        orderNumber: order.orderNumber
      });
    }

   
    if (paymentMethod === "Wallet") {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet || wallet.balance < createdOrders[0].finalAmount) {
        throw new Error("Insufficient wallet balance");
      }
      wallet.balance -= createdOrders[0].finalAmount;
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

export const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = req.params.orderId;


    if (!userId) {
      req.flash("error", "Please login to view order");
      return res.redirect("/login");
    }
    const user = await User.findById(userId).select("fullName email");

    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        select: "name images slug description category",
        match: { _id: { $exists: true } }
      })
      .populate({
        path: "items.variant",
        select: "size color images stock",
        match: { _id: { $exists: true } }
      });

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/orders");
    }

    if (order.user.toString() !== userId) {
      req.flash("error", "Access denied");
      return res.redirect("/orders");
    }

    const item = order.items[0] || {};
    const product = item.product || {};
    const variant = item.variant || {};

    const refund = await RefundRequest.findOne({
      order: orderId,
      user: userId
    }).sort({ createdAt: -1 });

    let refundData = null;
    if (refund) {
      const { _id, refundAmount, status } = refund
      refundData = {
        _id,
        refundId: `REF-${refund._id.toString().slice(-8).toUpperCase()}`,
        status,
        reason: refund.reason || refund.reasonCode,
        refundAmount,
        refundMethod: refund.refundMethod,
        requestedAt: refund.createdAt,
        estimatedCompletion: refund.estimatedCompletion,
        ...(refund.approvedAt && { approvedAt: refund.approvedAt }),
        ...(refund.pickupScheduledAt && { pickup_scheduledAt: refund.pickupScheduledAt }),
        ...(refund.pickedUpAt && { picked_upAt: refund.pickedUpAt }),
        ...(refund.refundInitiatedAt && { refund_initiatedAt: refund.refundInitiatedAt }),
        ...(refund.refundCompletedAt && { refund_completedAt: refund.refundCompletedAt })
      };
    }

    let displayAddress = {};
    if (order.address && typeof order.address === 'object') {
      displayAddress = {
        fullName: order.address.fullName || "Not Available",
        phone: order.address.phone || "",
        house: order.address.house || order.address.addressLine1 || "Address information",
        city: order.address.city || "",
        state: order.address.state || "",
        pincode: order.address.pincode || order.address.postalCode || "",
        landmark: order.address.landmark || "",
        country: order.address.country || "India"
      };
    }
    const imageSrc = resolveImage(
      variant?.images?.[0] || product?.images?.[0]
    );

    const safeOrder = {
      ...order.toObject(),
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      address: displayAddress,

      item: {
        product: {
          _id: product._id,
          name: product.name || "Product",
          images: product.images || [],
          description: product.description || "",
          slug: product.slug || "",
          category: product.category || ""
        },
        variant: {
          _id: variant._id,
          size: variant.size,
          color: variant.color,
          images: variant.images || [],
          stock: variant.stock || 0
        },
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: item.total || 0,
        imageSrc: imageSrc
      },

      items: [{
        product: product,
        variant: variant,
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: item.total || 0
      }]
    };



    res.render("user/pages/orderDetails", {
      order: safeOrder,
      refund: refundData,
      userName: user.fullName,
      userEmail: user.email,
      pageJs: "success.js"
    });
  } catch (error) {
    console.error("Order Details Error:", error);
    req.flash("error", "Error loading order details");
    res.redirect("/orders");
  }
};


export const loadMyOrders = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      req.flash("error", "Please login to view orders");
      return res.redirect("/login");
    }

    const { status, search, sort = 'newest', page = 1 } = req.query;
    const limit = 10;
    const currentPage = parseInt(page);

    let query = { user: userId };

    if (status) {
      query.orderStatus = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { orderNumber: regex },
        { _id: search.match(/^[0-9a-fA-F]{24}$/) ? search : null }
      ];
    }


    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'highest') sortOption = { finalAmount: -1 };
    if (sort === 'lowest') sortOption = { finalAmount: 1 };


    const totalOrdersCount = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrdersCount / limit);


    const skip = (currentPage - 1) * limit;

    const orders = await Order.find(query)
      .populate({
        path: "items.product",
        select: "name slug description",
        match: { _id: { $exists: true } }
      })
      .populate({
        path: "items.variant",
        select: "size color images",
        match: { _id: { $exists: true } }
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

  const groupedOrders = {};

orders.forEach(order => {
  const key = new Date(order.createdAt).toISOString().slice(0, 16); // same minute

  if (!groupedOrders[key]) {
    groupedOrders[key] = {
      createdAt: order.createdAt,
      orders: [],
      totalAmount: 0
    };
  }

  groupedOrders[key].orders.push(order);
  groupedOrders[key].totalAmount += order.finalAmount;
});

const groupedOrderList = Object.values(groupedOrders);

    const formattedOrders = orders.map(order => {

      const item = order.items[0] || {};
      const variant = item.variant || {};
      const product = item.product || { name: "Product" };


      const variantImage = resolveImage(variant?.images?.[0]);


      const itemPrice = item.price || 0;
      const itemTotal = item.total || 0;
      const quantity = item.quantity || 1;

      return {
        ...order,
        orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`,

        item: {
          product: {
            _id: product._id,
            name: product.name,
            description: product.description || "",
            slug: product.slug || "",
            image: variantImage
          },
          variant: {
            size: variant.size,
            color: variant.color,
            images: variant.images || []
          },
          quantity: quantity,
          price: itemPrice,
          total: itemTotal
        },

        items: [{
          product: product,
          variant: variant,
          quantity: quantity,
          price: itemPrice,
          total: itemTotal
        }]
      };
    });

    const statusCounts = {
      Placed: await Order.countDocuments({ user: userId, orderStatus: 'Placed' }),
      Confirmed: await Order.countDocuments({ user: userId, orderStatus: 'Confirmed' }),
      Shipped: await Order.countDocuments({ user: userId, orderStatus: 'Shipped' }),
      Delivered: await Order.countDocuments({ user: userId, orderStatus: 'Delivered' }),
      Cancelled: await Order.countDocuments({ user: userId, orderStatus: 'Cancelled' })
    };

    res.render("user/pages/myOrders", {
      orders: formattedOrders,
      totalOrders: totalOrdersCount,
        groupedOrders: groupedOrderList,
      page: currentPage,
      totalPages: totalPages,
      statusFilter: status || null,
      searchQuery: search || '',
      sortBy: sort,
      statusCounts: statusCounts,
      userName: "User",
      userEmail: "",
      pageJs: "allorder.js"
    });
  } catch (error) {
    console.error("Load My Orders Error:", error);
    req.flash("error", "Error loading orders");
    res.redirect("/");
  }
};
pageJs: "allorder.js"


export const cancelUserOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = req.params.orderId;
    const { reason, reasonCode } = req.body;

    if (!userId) {
      console.log('User not logged in');
      return res.status(401).json({
        success: false,
        message: "Please login to cancel order"
      });
    }


    const order = await Order.findById(orderId);

    if (!order) {
      console.log('Order not found');
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }


    if (order.user.toString() !== userId) {
      console.log('User does not own this order');
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this order"
      });
    }
   if (order.refundStatus === 'Refunded') {
      return res.status(400).json({ message: "Order already refunded" });
    }

    const allowedStatuses = ['Placed', 'Confirmed'];
    if (!allowedStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.orderStatus}`
      });
    }


   order.orderStatus = 'Cancelled';

order.items.forEach(item => {
  item.itemStatus = 'Cancelled';
  item.cancelledAt = new Date();
});

    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.cancellationReasonCode = reasonCode;


    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: 'Cancelled',
      changedAt: new Date(),
      notes: `Cancelled by user. Reason: ${reason}`,
      changedBy: userId
    });



    if (order.paymentMethod === 'COD') {
      order.paymentStatus = 'Refunded';
    }


    if (
      (order.paymentMethod === 'Wallet' || order.paymentMethod === 'Razorpay') &&
      order.paymentStatus === 'Paid'
    ) {
   const refundAmount = Math.max(order.subtotal - order.discount, 0);

const wallet = await Wallet.findOne({ user: order.user });

if (!wallet) {
  throw new Error("Wallet not found");
}

wallet.balance += refundAmount;

wallet.transactions.push({
  amount: refundAmount,
  type: "credit",
  description: `Refund for order ${order.orderNumber} (excluding tax & shipping)`,
  status: "success",
  payment_method: "wallet",
  createdAt: new Date()
});

await wallet.save();


      order.paymentStatus = "Refunded";


    }


    for (const item of order.items) {
      await Variant.findByIdAndUpdate(
        item.variant,
        { $inc: { stock: item.quantity } }
      );
    }

    await order.save();

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        orderId: order._id,
        status: order.orderStatus,
        reason: reason
      }
    });


  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error cancelling order"
    });
  }
};
export const loadRefundRequest = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderId = req.params.orderId;
    if (!userId) {
      req.flash("error", "Please login to request refund");
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select("fullName email");

    const order = await Order.findById(orderId)
      .populate({
        path: "items.product",
        select: "name images slug",
        match: { _id: { $exists: true } }
      })
      .populate({
        path: "items.variant",
        select: "size color images",
        match: { _id: { $exists: true } }
      })
      .populate({
        path: "coupon",
        select: "code name"
      });

    if (!order) {
      req.flash("error", "Order not found");
      return res.redirect("/orders");
    }

    if (order.user.toString() !== userId) {
      req.flash("error", "Access denied");
      return res.redirect("/orders");
    }

    if (order.orderStatus !== 'Delivered') {
      req.flash("error", "Refund can only be requested for delivered orders");
      return res.redirect(`/orders/${orderId}`);
    }

    const existingRefund = await RefundRequest.findOne({
      order: orderId,
      user: userId,
      status: { $in: ['pending', 'approved', 'pickup_scheduled', 'picked_up'] }
    });

    if (existingRefund) {
      req.flash("error", "Refund request already exists for this order");
      return res.redirect(`/orders/${orderId}`);
    }

    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    const safeOrder = {
      ...order.toObject(),

      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      tax: order.tax || 0,
      shipping: order.shipping || 0,
      finalAmount: order.finalAmount || 0,
      couponCode: order.coupon?.code || '',
      couponName: order.coupon?.name || '',

      orderNumber: `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      items: order.items.map(item => ({
        product: item.product || { name: "Product", images: [] },
        variant: item.variant || { size: null, color: null, images: [] },
        quantity: item.quantity || 1,
        price: item.price || 0,
        total: item.total || 0
      }))
    };

    res.render("user/pages/refundRequest", {
      order: safeOrder,
      addresses,
      userName: user.fullName,
      userEmail: user.email,
      pageJs: "refundRequest.js"
    });
  } catch (error) {
    console.error("Load Refund Request Error:", error);
    req.flash("error", "Error loading refund request page");
    res.redirect("/orders");
  }
};


export const submitRefundRequest = async (req, res) => {
  try {
    const userId = req.session.userId;
    const {
      orderId,
      reasonCode,
      customReason,
      additionalDetails,
      returnAddress,
      refundMethod,
      items
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to request refund"
      });
    }

    if (!orderId || !reasonCode || !returnAddress || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled"
      });
    }
    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('items.variant');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (order.orderStatus !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: "Refund can only be requested for delivered orders"
      });
    }

    const existingRefund = await RefundRequest.findOne({
      order: orderId,
      user: userId,
      status: { $in: ['pending', 'approved', 'pickup_scheduled', 'picked_up'] }
    });

    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: "Refund request already exists for this order"
      });
    }

    const address = await Address.findOne({
      _id: returnAddress,
      userId
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const returnAddressData = {
      fullName: address.fullName || "",
      phone: address.phone || "",
      house: address.house || address.addressLine1 || "",
      city: address.city || "",
      state: address.state || "",
      pincode: address.pincode || address.postalCode || "",
      landmark: address.landmark || ""
    };

    const reasonCodeMap = {
      'defective_product': 'Defective Product',
      'wrong_item': 'Wrong Item Received',
      'size_issue': 'Size Issue',
      'quality_issue': 'Quality Issue',
      'damaged': 'Damaged Product',
      'not_as_described': 'Not as Described',
      'late_delivery': 'Late Delivery',
      'other': 'Other Reason'
    };

    const reasonText = customReason || reasonCodeMap[reasonCode] || 'General Refund Request';


    let totalReturnSubtotal = 0;
    const itemsWithIds = [];

    for (const item of items) {
    const orderItem = order.items.find(orderItem =>
  orderItem.product?._id.toString() === item.product &&
  (
    !item.variant ||
    orderItem.variant?._id?.toString() === item.variant
  )
);



      if (orderItem) {
        const itemSubtotal = orderItem.price * item.quantity;
        totalReturnSubtotal += itemSubtotal;

       itemsWithIds.push({
  product: orderItem.product?._id || null,
  productName: orderItem.product?.name || 'Product',
  productImage:
    orderItem.variant?.images?.[0] ||
    orderItem.product?.images?.[0] ||
    null,

  variant: orderItem.variant?._id || null,
  variantColor: orderItem.variant?.color || null,
  variantSize: orderItem.variant?.size || null,

  quantity: parseInt(item.quantity),
  price: orderItem.price,
  total: itemSubtotal,
  reason: item.reason || 'general'
});


      }
    }
    let refundAmount = 0;
    if (order.discount && order.discount > 0) {

      const originalSubtotal = order.subtotal;
      const returnPercentage = totalReturnSubtotal / originalSubtotal;
      const applicableDiscount = order.discount * returnPercentage;
      const returnTax = (totalReturnSubtotal / originalSubtotal) * order.tax;
      const returnShipping = (totalReturnSubtotal / originalSubtotal) * order.shipping;
      refundAmount = totalReturnSubtotal - applicableDiscount + returnTax + returnShipping;
    } else {

      const returnPercentage = totalReturnSubtotal / order.subtotal;
      const returnTax = (totalReturnSubtotal / order.subtotal) * order.tax;
      const returnShipping = (totalReturnSubtotal / order.subtotal) * order.shipping;

      refundAmount = totalReturnSubtotal + returnTax + returnShipping;
    }
    refundAmount = Math.max(0, refundAmount);

    refundAmount = Math.round(refundAmount * 100) / 100;

    const refundRequest = await RefundRequest.create({
      order: orderId,
      user: userId,
      reason: reasonText,
      reasonCode: reasonCode,
      customReason: customReason || '',
      additionalDetails: additionalDetails || '',
      returnAddress: returnAddressData,
      refundAmount: refundAmount,
      items: itemsWithIds,
      refundMethod: refundMethod || 'original_method',
      status: 'pending',
      originalOrderAmount: order.finalAmount,
      originalOrderDiscount: order.discount
    });

    res.json({
      success: true,
      message: "Refund request submitted successfully",
      refundId: refundRequest._id,
      data: {
        refundId: refundRequest._id,
        status: refundRequest.status,
        refundAmount: refundRequest.refundAmount,
        estimatedProcessing: '7-10 business days'
      }
    });

  } catch (error) {
    console.error("Submit Refund Request Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error submitting refund request"
    });
  }
};

export const getUserRefunds = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      req.flash("error", "Please login to view refunds");
      return res.redirect("/login");
    }

    const refunds = await RefundRequest.find({ user: userId })
      .populate('order', 'orderNumber finalAmount createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.render("user/pages/myRefunds", {
      refunds,
      userName: "User",
      pageJs: "refunds.js"
    });
  } catch (error) {
    console.error("Get User Refunds Error:", error);
    req.flash("error", "Error loading refund requests");
    res.redirect("/orders");
  }
};

export const checkRefundStatus = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const { lastChecked } = req.query;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to check refund status"
      });
    }

    const refund = await RefundRequest.findById(id);
    if (!refund) {
      console.log('Refund not found');
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }
    if (refund.user.toString() !== userId) {
      console.log('User does not own this refund');
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }
    let hasUpdate = false;
    let changes = [];

    if (lastChecked) {
      const lastCheckedDate = new Date(lastChecked);
      const updatedAtDate = new Date(refund.updatedAt);

      hasUpdate = updatedAtDate > lastCheckedDate;

      if (hasUpdate) {
        changes.push({
          field: 'status',
          from: 'previous',
          to: refund.status
        });
      }
    }
    const stepDates = {
      requestedAt: refund.createdAt,
      approvedAt: refund.approvedAt,
      pickupScheduledAt: refund.pickupScheduledAt,
      pickedUpAt: refund.pickedUpAt,
      refundInitiatedAt: refund.refundInitiatedAt,
      refundCompletedAt: refund.refundCompletedAt,
      rejectedAt: refund.rejectedAt,
      updatedAt: refund.updatedAt
    };


    res.json({
      success: true,
      hasUpdate: hasUpdate,
      currentStatus: refund.status,
      updatedAt: refund.updatedAt,
      data: {
        id: refund._id,
        status: refund.status,
        stepDates: stepDates,
        refundAmount: refund.refundAmount,
        refundMethod: refund.refundMethod,
        reason: refund.reason,
        changes: changes
      }
    });

  } catch (error) {
    console.error('Check refund status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Error checking refund status"
    });
  }
};


export const getRefundDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to view refund details"
      });
    }

    // Find the refund request with populated data
    const refund = await RefundRequest.findById(id)
      .populate({
        path: 'order',
        select: 'orderNumber finalAmount createdAt orderStatus'
      })
      .populate({
        path: 'items.product',
        select: 'name images'
      })
      .populate({
        path: 'items.variant',
        select: 'size color'
      });

    if (!refund) {
      console.log('Refund not found');
      return res.status(404).json({
        success: false,
        message: 'Refund request not found'
      });
    }


    if (refund.user.toString() !== userId) {
      console.log('User does not own this refund');
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }


    const refundData = {
      _id: refund._id,
      refundId: `REF-${refund._id.toString().slice(-8).toUpperCase()}`,
      status: refund.status,
      reason: refund.reason,
      customReason: refund.customReason,
      additionalDetails: refund.additionalDetails,
      refundAmount: refund.refundAmount,
      refundMethod: refund.refundMethod,
      returnAddress: refund.returnAddress,
      stepDates: {
        requestedAt: refund.createdAt,
        approvedAt: refund.approvedAt,
        pickupScheduledAt: refund.pickupScheduledAt,
        pickedUpAt: refund.pickedUpAt,
        refundInitiatedAt: refund.refundInitiatedAt,
        refundCompletedAt: refund.refundCompletedAt,
        rejectedAt: refund.rejectedAt,
        updatedAt: refund.updatedAt
      },
      items: refund.items.map(item => ({
        product: item.product ? {
          _id: item.product._id,
          name: item.product.name,
          image: resolveImage(item.product?.images?.[0])

        } : null,
        variant: item.variant ? {
          _id: item.variant._id,
          size: item.variant.size,
          color: item.variant.color
        } : null,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      order: refund.order ? {
        _id: refund.order._id,
        orderNumber: refund.order.orderNumber,
        finalAmount: refund.order.finalAmount,
        orderStatus: refund.order.orderStatus
      } : null,
      estimatedCompletion: refund.estimatedCompletion,
      adminNotes: refund.adminNotes || []
    };



    res.json({
      success: true,
      message: "Refund details fetched successfully",
      data: refundData
    });

  } catch (error) {
    console.error('Get refund details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching refund details"
    });
  }
};


export const loadUserInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;


    const order = await Order.findById(id)
      .populate('items.product')
      .populate('user')
      .populate('address');

    if (!order) return res.redirect('/orders');

    const sessionUserId = req.session.user?._id || req.session.userId;
    if (!sessionUserId || order.user._id.toString() !== sessionUserId.toString()) {
      return res.redirect('/orders');
    }

    /* ================= PDF SETUP ================= */
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const fileName = `Invoice-${order.orderNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    doc.pipe(res);

    /* ================= CONSTANTS ================= */
    const PAGE_LEFT = 50;
    const PAGE_RIGHT = doc.page.width - 50;

    const formatDate = (date) =>
      new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

    const formatCurrency = (amount) =>
      '₹' + Number(amount || 0).toLocaleString('en-IN');

    /* ================= HEADER ================= */
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#2C3E50')
      .text('LUXTIME', PAGE_LEFT, 50);

    doc.font('Helvetica').fontSize(10).fillColor('#7F8C8D')
      .text('Premium Watches & Accessories', PAGE_LEFT, 85);

    doc.font('Helvetica-Bold').fontSize(24).fillColor('#E74C3C')
      .text('INVOICE', PAGE_RIGHT - 150, 50, { align: 'right' });

    doc.fontSize(12).fillColor('#34495E')
      .text(`#${order.orderNumber}`, PAGE_RIGHT - 150, 85, { align: 'right' });

    doc.strokeColor('#E0E0E0').lineWidth(0.5)
      .moveTo(PAGE_LEFT, 110)
      .lineTo(PAGE_RIGHT, 110)
      .stroke();

    /* ================= BILLED FROM & DETAILS ================= */
    const startY = 130;
    const leftColX = PAGE_LEFT;
    const rightColX = PAGE_LEFT + 300;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#2C3E50')
      .text('BILLED FROM:', leftColX, startY);

    doc.font('Helvetica').fillColor('#34495E')
      .text('LuxTime Watches Pvt. Ltd.', leftColX, startY + 18)
      .text('123 Luxury Street', leftColX, startY + 32)
      .text('Mumbai, Maharashtra - 400001', leftColX, startY + 46)
      .text('GSTIN: 27AABCU9603R1ZX', leftColX, startY + 60)
      .text('contact@luxtime.com | +91 98765 43210', leftColX, startY + 74);

    doc.font('Helvetica-Bold').fillColor('#2C3E50')
      .text('INVOICE DETAILS:', rightColX, startY);

    const details = [
      ['Invoice Number', `#${order.orderNumber}`],
      ['Invoice Date', formatDate(order.createdAt)],
      ['Order Date', formatDate(order.createdAt)],
      ['Payment Status', order.paymentStatus || 'PAID']
    ];

    let dY = startY + 18;
    details.forEach(([label, value]) => {
      doc.font('Helvetica').fillColor('#34495E')
        .text(label, rightColX, dY)
        .text(value, PAGE_RIGHT - 100, dY, { align: 'right' });
      dY += 16;
    });

    /* ================= CUSTOMER & ADDRESS ================= */
    const customerY = startY + 110;

    doc.font('Helvetica-Bold').fillColor('#2C3E50')
      .text('BILLED TO:', leftColX, customerY);

    doc.font('Helvetica').fillColor('#34495E')
      .text(order.user.fullName, leftColX, customerY + 18)
      .text(order.user.email, leftColX, customerY + 34);

    doc.font('Helvetica-Bold').fillColor('#2C3E50')
      .text('SHIPPING ADDRESS:', rightColX, customerY);

    doc.font('Helvetica').fillColor('#34495E')
      .text(order.address.fullName, rightColX, customerY + 18)
      .text(order.address.house, rightColX, customerY + 34)
      .text(`${order.address.city}, ${order.address.state}`, rightColX, customerY + 50)
      .text(`PIN: ${order.address.pincode}`, rightColX, customerY + 66);

    /* ================= ITEMS TABLE ================= */
   /* ================= ITEMS TABLE ================= */
const tableTop = customerY + 110;
const rowHeight = 26;

const col = {
  sn: PAGE_LEFT,
  desc: PAGE_LEFT + 30,
  qty: PAGE_LEFT + 300,
  price: PAGE_LEFT + 350,
  total: PAGE_RIGHT - 70
};

/* Header background */
doc.fillColor('#2C3E50')
  .rect(PAGE_LEFT, tableTop, PAGE_RIGHT - PAGE_LEFT, rowHeight)
  .fill();

/* Header text */
doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
  .text('#', col.sn + 5, tableTop + 8)
  .text('Product', col.desc, tableTop + 8, { width: 250 })
  .text('QTY', col.qty, tableTop + 8, { width: 40, align: 'center' })
  .text('UNIT PRICE', col.price, tableTop + 8, { width: 70, align: 'right' })
  .text('TOTAL', col.total, tableTop + 8, { width: 70, align: 'right' });

let rowY = tableTop + rowHeight;
let subtotal = 0;

/* Table rows */
order.items.forEach((item, i) => {
  const itemTotal = item.price * item.quantity;
  subtotal += itemTotal;

  // Row divider
  doc.strokeColor('#E0E0E0').lineWidth(0.5)
    .moveTo(PAGE_LEFT, rowY)
    .lineTo(PAGE_RIGHT, rowY)
    .stroke();

  doc.font('Helvetica').fontSize(9).fillColor('#2C3E50')
    .text(i + 1, col.sn + 5, rowY + 8)
    .text(item.product?.name || 'Product',
      col.desc,
      rowY + 6,
      { width: 250 }
    )
    .text(item.quantity,
      col.qty,
      rowY + 8,
      { width: 40, align: 'center' }
    )
    .text(formatCurrency(item.price),
      col.price,
      rowY + 8,
      { width: 70, align: 'right' }
    )
    .text(formatCurrency(itemTotal),
      col.total,
      rowY + 8,
      { width: 70, align: 'right' }
    );

  rowY += rowHeight;
});

/* Bottom border */
doc.strokeColor('#E0E0E0')
  .moveTo(PAGE_LEFT, rowY)
  .lineTo(PAGE_RIGHT, rowY)
  .stroke();
/* ================= TOTALS ================= */
const totalsY = rowY + 20;

const tax =  round2(order.tax || 0);
const shipping = round2(order.shipping || 0);
const discount =round2(order.discount || 0);

const totals = [
  ['Subtotal', subtotal],
  ['Tax', tax],
  ['Shipping', shipping],
  ['Discount', -discount],
];

let tY = totalsY;

totals.forEach(([label, value]) => {
  doc.font('Helvetica').fontSize(10).fillColor('#34495E')
    .text(label + ':', PAGE_RIGHT - 200, tY, { width: 100, align: 'right' })
    .text(formatCurrency(value), PAGE_RIGHT - 90, tY, { width: 80, align: 'right' });
  tY += 16;
});

/* Grand total highlight */
doc.strokeColor('#E74C3C').lineWidth(1)
  .moveTo(PAGE_RIGHT - 200, tY + 4)
  .lineTo(PAGE_RIGHT, tY + 4)
  .stroke();

doc.font('Helvetica-Bold').fontSize(12).fillColor('#E74C3C')
  .text('Grand Total:', PAGE_RIGHT - 200, tY + 10, { width: 100, align: 'right' })
  .text(formatCurrency(order.finalAmount), PAGE_RIGHT - 90, tY + 10, { width: 80, align: 'right' });

    /* ================= FOOTER ================= */
    const footerY = doc.page.height - 90;

    doc.strokeColor('#E0E0E0')
      .moveTo(PAGE_LEFT, footerY - 15)
      .lineTo(PAGE_RIGHT, footerY - 15)
      .stroke();

    doc.font('Helvetica').fontSize(8).fillColor('#7F8C8D')
      .text(
        'This is a computer-generated invoice. All disputes subject to Mumbai jurisdiction.',
        PAGE_LEFT,
        footerY,
        { width: PAGE_RIGHT - PAGE_LEFT, align: 'center' }
      );

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#2C3E50')
      .text(
        'Thank You For Shopping With LuxTime!',
        PAGE_LEFT,
        footerY + 30,
        { width: PAGE_RIGHT - PAGE_LEFT, align: 'center' }
      );

    doc.end();

  } catch (err) {
    console.error('Invoice PDF error:', err);
    res.redirect('/orders');
  }
};
