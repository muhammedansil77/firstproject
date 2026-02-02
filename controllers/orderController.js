
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

export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("items.variant");

    const address = await Address.findById(addressId);

    if (!cart || !address) {
      return res.status(400).json({ success: false });
    }

    const items = cart.items.map(i => ({
      product: i.product._id,
      variant: i.variant._id,
      quantity: i.quantity,
      price: i.variant.salePrice,
      total: i.quantity * i.variant.salePrice
    }));

    const subtotal = items.reduce((a, b) => a + b.total, 0);

    const order = await Order.create({
      user: userId,
      address,
      items,
      subtotal,
      tax: 0,
      discount: 0,
      shipping: 0,
      finalAmount: subtotal,
      paymentMethod: "COD"
    });

    await Cart.deleteOne({ user: userId });

    res.json({
      success: true,
      orderId: order._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
export const retryRazorpayPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus !== 'Failed') {
      return res.json({ success: false, message: 'Order not eligible for retry' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: 'INR',
      receipt: order.orderNumber
    });

  
    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = 'Pending';
    order.orderStatus = 'Pending Payment';   

    order.razorpayPaymentId = null;
    order.razorpaySignature = null;

    await order.save();

    res.json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: process.env.RAZORPAY_KEY_ID
      }
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Retry payment failed' });
  }
};

export const orderss = async(req,res)=>{
  try{
const userId = "6978332a57c460e99568a614";
    const order =  await Order.countDocuments([{$group:{
      _id:"$userId",
      totalOrder:{$sum:1}
    }}])
  }catch(err){

  }
}