import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: 1 // 0 means unlimited
  },
  perUserLimit: {
    type: Number,
    default: 1
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usersUsed: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicableProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
couponSchema.index({ code: 1, isActive: 1, isDeleted: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware to format code
couponSchema.pre('save', function(next) {
  this.code = this.code.toUpperCase().trim();
  this.updatedAt = Date.now();
  next();
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function(userId = null) {
  const now = new Date();
  
  // Basic validity checks
  if (!this.isActive || this.isDeleted) return false;
  if (now < this.startDate || now > this.endDate) return false;
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) return false;
  
  // Check per user limit
  if (userId && this.perUserLimit > 0) {
    const userUsageCount = this.usersUsed.filter(
      usage => usage.user.toString() === userId.toString()
    ).length;
    if (userUsageCount >= this.perUserLimit) return false;
  }
  
  return true;
};

// Method to apply coupon
couponSchema.methods.applyCoupon = function(totalAmount, userId = null) {
  if (!this.isValid(userId)) {
    throw new Error('Coupon is not valid');
  }
  
  if (this.minPurchaseAmount > 0 && totalAmount < this.minPurchaseAmount) {
    throw new Error(`Minimum purchase amount of ₹${this.minPurchaseAmount} required`);
  }
  
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (totalAmount * this.discountValue) / 100;
  } else {
    discount = this.discountValue;
  }
  
  // Apply max discount limit if set
  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }
  
  // Ensure discount doesn't exceed total amount
  discount = Math.min(discount, totalAmount);
  
  const finalAmount = totalAmount - discount;
  
  return {
    discount,
    finalAmount,
    isValid: true
  };
};

// Static method to validate coupon
couponSchema.statics.validateCoupon = async function(code, userId, totalAmount) {
  const coupon = await this.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
    isDeleted: false
  });
  
  if (!coupon) {
    return {
      isValid: false,
      message: 'Invalid coupon code'
    };
  }
  
  const now = new Date();
  if (now < coupon.startDate) {
    return {
      isValid: false,
      message: `Coupon will be valid from ${coupon.startDate.toLocaleDateString()}`
    };
  }
  
  if (now > coupon.endDate) {
    return {
      isValid: false,
      message: 'Coupon has expired'
    };
  }
  
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      isValid: false,
      message: 'Coupon usage limit reached'
    };
  }
  
  if (userId && coupon.perUserLimit > 0) {
    const userUsageCount = coupon.usersUsed.filter(
      usage => usage.user.toString() === userId.toString()
    ).length;
    if (userUsageCount >= coupon.perUserLimit) {
      return {
        isValid: false,
        message: 'You have already used this coupon'
      };
    }
  }
  
  if (coupon.minPurchaseAmount > 0 && totalAmount < coupon.minPurchaseAmount) {
    return {
      isValid: false,
      message: `Minimum purchase of ₹${coupon.minPurchaseAmount} required`
    };
  }
  
  return {
    isValid: true,
    coupon,
    message: 'Coupon is valid'
  };
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;