import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    address: {
      fullName: String,
      phone: String,
      house: String,
      city: String,
      state: String,
      pincode: String
    },

    items: [
  {
    orderItemId: {
      type: String,
      required: true
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant"
    },

    quantity: Number,
    price: Number,
    total: Number,

    itemStatus: {
      type: String,
      enum: ["Pending Payment","Placed", "Shipped", "Delivered", "Cancelled", "Returned"],
      default: "Placed"
    },

    cancelledAt: Date,
    returnReason: String
  }
]

,

    subtotal: Number,
    tax: Number,
    discount: Number,
    shipping: Number,

    finalAmount: {
      type: Number,
      required: true
    },

  
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon"
    },
    
    couponCode: {
      type: String,
      trim: true,
      default: null
    },
    
    couponDiscount: {
      type: Number,
      default: 0
    },
    
    couponDetails: {
      name: String,
      discountType: {
        type: String,
        enum: ["percentage", "fixed"]
      },
      discountValue: Number,
      maxDiscountAmount: Number
    },

    // Payment method
    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay", "Wallet"],
      default: "COD"
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded", "Refund Initiated"],
      default: "Pending"
    },

   orderStatus: {
  type: String,
  enum: [
    "Pending Payment",
    "Placed",
    "Confirmed",
    "Shipped",
    "OutForDelivery",
    "Delivered",
    "Cancelled"
  ],
  default: "Pending Payment"
}
,

    // RAZORPAY PAYMENT FIELDS
    razorpayOrderId: {
      type: String,
      default: null
    },
    
    razorpayPaymentId: {
      type: String,
      default: null
    },
    
    razorpaySignature: {
      type: String,
      default: null
    },

    // WALLET PAYMENT FIELD (optional)
    walletTransactionId: {
      type: String,
      default: null
    },

    // CANCELLATION FIELDS
    cancellationReason: {
      type: String,
      default: null
    },
    
    cancellationReasonCode: {
      type: String,
      default: null
    },
    
    cancelledAt: {
      type: Date,
      default: null
    },
    
    cancelledBy: {
      type: String,
      enum: ['user', 'admin', 'system'],
      default: 'user'
    },
    
    statusHistory: [{
      status: String,
      changedAt: Date,
      notes: String,
      changedBy: mongoose.Schema.Types.ObjectId
    }],

    // Optional: Add order number for easy reference
    orderNumber: {
      type: String,
      unique: true
    }
  },
  { timestamps: true }
);

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    try {
      let unique = false;
      let orderNumber;
      
      // Keep trying until we get a unique order number
      while (!unique) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(1000 + Math.random() * 9000);
        orderNumber = `ORD-${timestamp}${random}`;
        
        // Check if this order number already exists
        const existing = await mongoose.models.Order.findOne({ orderNumber });
        if (!existing) {
          unique = true;
        }
      }
      
      this.orderNumber = orderNumber;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Virtual for formatted discount
orderSchema.virtual('formattedDiscount').get(function() {
  if (this.couponDiscount > 0) {
    return `-₹${this.couponDiscount.toFixed(2)}`;
  }
  return null;
});

// Method to get coupon summary
orderSchema.methods.getCouponSummary = function() {
  if (!this.couponCode) {
    return null;
  }
  
  return {
    code: this.couponCode,
    name: this.couponDetails?.name || 'Coupon',
    discount: this.couponDiscount,
    discountType: this.couponDetails?.discountType || 'fixed',
    discountValue: this.couponDetails?.discountValue || 0
  };
};

export default mongoose.model("Order", orderSchema);