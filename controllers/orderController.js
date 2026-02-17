
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