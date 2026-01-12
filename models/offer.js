const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  description: { 
    type: String,
    trim: true 
  },
  type: { 
    type: String, 
    enum: ['product', 'category'], 
    required: true,
    index: true 
  },
  targetId: [{
    type: mongoose.Schema.Types.ObjectId,
    index: true
  }],
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true,
    min: 0 
  },
  maxDiscountAmount: { 
    type: Number,
    min: 0 
  },
  startDate: { 
    type: Date, 
    required: true,
    index: true 
  },
  endDate: { 
    type: Date, 
    required: true,
    index: true 
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  priority: { 
    type: Number, 
    default: 1,
    min: 1,
    max: 10 
  },
  conditions: {
    minPurchaseAmount: { type: Number, default: 0 },
    maxUsagePerUser: { type: Number, default: null },
    applicableForNewUsers: { type: Boolean, default: false }
  },
  usageCount: { type: Number, default: 0 },
  totalDiscountGiven: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
  
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual populate for product/category details
OfferSchema.virtual('product', {
  ref: 'Product',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true
});

OfferSchema.virtual('category', {
  ref: 'Category',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Offer', OfferSchema);