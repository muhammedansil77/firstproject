import mongoose from "mongoose";

// models/RefundRequest.js
const refundRequestSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Add to your RefundRequest schema
orderCoupon: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Coupon'
},
orderCouponCode: {
  type: String,
  trim: true
},
orderCouponDiscount: {
  type: Number,
  default: 0
},
couponDetails: {
  type: {
    name: String,
    discountType: String,
    discountValue: Number,
    maxDiscountAmount: Number
  },
  default: {}
},
refundBreakdown: {
  type: {
    productTotal: { type: Number, default: 0 },
    couponDiscount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    totalRefund: { type: Number, default: 0 }
  },
  default: {}
},

  status: {
    type: String,
    enum: [
      'pending',
      'approved',
      'rejected',
      'pickup_scheduled',
      'picked_up',
      'refund_initiated',
      'refund_completed',
      'cancelled'
    ],
    default: 'pending'
  },

  reason: String,
  reasonCode: String,
  customReason: String,
  additionalDetails: String,
  returnAddress: Object,

  refundAmount: Number,
  refundMethod: {
    type: String,
    enum: ['original_method', 'bank_transfer', 'upi', 'wallet_credit'],
    default: 'original_method'
  },

  // ✅ ADD THIS LINE
  walletRefunded: {
    type: Boolean,
    default: false
  },

items: [{
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },

  productName: String,      // ✅ ADD
  productImage: String,     // ✅ ADD

  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  },

  variantColor: String,     // ✅ ADD
  variantSize: String,      // ✅ ADD

  quantity: Number,
  price: Number,
  total: Number,
  reason: String
}]

,

  approvedAt: Date,
  pickupScheduledAt: Date,
  pickedUpAt: Date,
  refundInitiatedAt: Date,
  refundCompletedAt: Date,
  estimatedCompletion: Date

}, {
  timestamps: true
});


const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
export default RefundRequest;