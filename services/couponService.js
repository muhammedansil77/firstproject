import Coupon from "../models/Coupon.js";

const generateCouponCode = (prefix = '') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const timestamp = Date.now().toString(36).toUpperCase();
    let random = '';
    
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return prefix ? `${prefix}-${random}-${timestamp.slice(-4)}` : `${random}-${timestamp.slice(-4)}`;
};

export const getCouponStatsService = async () => {
  const today = new Date();

  const totalCoupons = await Coupon.countDocuments({ isDeleted: false });

  const activeCoupons = await Coupon.countDocuments({
    isActive: true,
    isDeleted: false,
    startDate: { $lte: today },
    endDate: { $gte: today }
  });

  const expiredCoupons = await Coupon.countDocuments({
    isDeleted: false,
    endDate: { $lt: today }
  });

  const expiringSoon = await Coupon.countDocuments({
    isDeleted: false,
    isActive: true,
    endDate: {
      $gte: today,
      $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  return {
    totalCoupons,
    activeCoupons,
    expiredCoupons,
    expiringSoon
  };
};
export const getAllCouponsService = async (queryParams) => {
  let {
    page = 1,
    limit = 10,
    status,
    search,
    sortBy = "createdAt",
    sortOrder = "desc"
  } = queryParams;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  const query = { isDeleted: false };
  const today = new Date();

  // Status filter
  if (status === "active") {
    query.isActive = true;
    query.startDate = { $lte: today };
    query.endDate = { $gte: today };
  } else if (status === "inactive") {
    query.isActive = false;
  } else if (status === "expired") {
    query.endDate = { $lt: today };
  } else if (status === "upcoming") {
    query.startDate = { $gt: today };
  }

  // Search filter
  if (search && search.trim()) {
    query.$or = [
      { code: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

  // Pagination + Sorting
  const skip = (page - 1) * limit;
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;

  const coupons = await Coupon.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Coupon.countDocuments(query);

  return {
    coupons,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};


export const createCouponService = async (body) => {
  const {
    name,
    code,
    description,
    discountType,
    discountValue,
    minPurchaseAmount,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    perUserLimit,
    isActive = true,
    couponType = "single",
    bulkCount = 1,
    bulkPrefix = ""
  } = body;
console.log("minPurchaseAmount:", minPurchaseAmount);
console.log("type:", typeof minPurchaseAmount);
  const parsedMinPurchase = Number(minPurchaseAmount);

  if (!name || name.trim().length < 2) {
    throw new Error("Coupon name is required");
  }

  if (!discountType) {
    throw new Error("Discount type is required");
  }

  if (discountValue === undefined || discountValue === null || discountValue === "") {
    throw new Error("Discount value is required");
  }


if (minPurchaseAmount === undefined || minPurchaseAmount === null) {
  throw new Error("Minimum purchase amount is required");
}



if (isNaN(parsedMinPurchase) || parsedMinPurchase <= 0) {
  throw new Error("Minimum purchase amount must be greater than 0");
}

  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required");
  }


  const parsedDiscountValue = Number(discountValue);


  const parsedUsageLimit =
    usageLimit === "" || usageLimit === undefined ? 0 : Number(usageLimit);

  const parsedPerUserLimit =
    perUserLimit === "" || perUserLimit === undefined ? 1 : Number(perUserLimit);

  const parsedMaxDiscount =
    maxDiscountAmount !== undefined && maxDiscountAmount !== ""
      ? Number(maxDiscountAmount)
      : null;


  if (isNaN(parsedMinPurchase) || parsedMinPurchase < 0) {
    throw new Error("Minimum purchase amount must be a valid non-negative number");
  }

  if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
    throw new Error("Discount value must be greater than 0");
  }




  if (discountType === "percentage") {
    if (parsedDiscountValue > 100) {
      throw new Error("Percentage discount must be between 1 and 100");
    }
  }

  if (discountType === "fixed") {
    if (parsedMinPurchase > 0 && parsedDiscountValue > parsedMinPurchase) {
      throw new Error("Fixed discount cannot be greater than minimum purchase amount");
    }
  }


  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }

  if (start >= end) {
    throw new Error("End date must be after start date");
  }

 
  if (couponType === "bulk" && Number(bulkCount) > 1) {
    const coupons = [];

    for (let i = 0; i < bulkCount; i++) {
      const uniqueCode = bulkPrefix
        ? `${bulkPrefix}-${generateCouponCode()}`
        : generateCouponCode();

      coupons.push({
        code: uniqueCode.toUpperCase(),
        name: `${name} #${i + 1}`,
        description,
        discountType,
        discountValue: parsedDiscountValue,
        minPurchaseAmount: parsedMinPurchase,
        maxDiscountAmount: parsedMaxDiscount,
        startDate: start,
        endDate: end,
        usageLimit: parsedUsageLimit,
        perUserLimit: parsedPerUserLimit,
        isActive
      });
    }

    const savedCoupons = await Coupon.insertMany(coupons);

    return {
      type: "bulk",
      count: bulkCount,
      coupons: savedCoupons
    };
  }

 
  let couponCode = code ? code.toUpperCase() : generateCouponCode();

  const existingCoupon = await Coupon.findOne({
    code: couponCode,
    isDeleted: false
  });

  if (existingCoupon) {
    throw new Error("Coupon code already exists");
  }

  const coupon = await Coupon.create({
    code: couponCode,
    name,
    description,
    discountType,
    discountValue: parsedDiscountValue,
    minPurchaseAmount: parsedMinPurchase,
    maxDiscountAmount: parsedMaxDiscount,
    startDate: start,
    endDate: end,
    usageLimit: parsedUsageLimit,
    perUserLimit: parsedPerUserLimit,
    isActive
  });

  return {
    type: "single",
    coupons: coupon
  };
};
