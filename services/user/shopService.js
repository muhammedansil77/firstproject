import path from 'path';
import mongoose from 'mongoose';


import productModel from '../../models/Product.js';
import categoryModel from '../../models/Category.js';
import { getBestOfferForProduct } from '../../helpers/offerHelper.js';


function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const loadShopService = async ({
  productModel,
  categoryModel,
  query
}) => {

  const search = (query.search || "").trim();
  const sort = query.sort || "";
  const category = (query.category || "").trim();

  const minPrice =
    query.min !== undefined && query.min !== ""
      ? Number(query.min)
      : null;

  const maxPrice =
    query.max !== undefined && query.max !== ""
      ? Number(query.max)
      : null;

  const currentPage = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.max(1, parseInt(query.limit || "12", 10));
  const skip = (currentPage - 1) * limit;

  const match = {
    isDeleted: { $ne: true },
    status: "active"
  };

  if (search) {
    match.$or = [
      { name: { $regex: escapeRegex(search), $options: "i" } },
      { description: { $regex: escapeRegex(search), $options: "i" } }
    ];
  }

  if (category && category !== "all") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      match.category = new mongoose.Types.ObjectId(category);
    } else if (categoryModel) {
      const catDoc = await categoryModel.findOne(
        {
          name: { $regex: "^" + escapeRegex(category) + "$", $options: "i" },
          active: true,
          isDeleted: { $ne: true }
        },
        { _id: 1 }
      ).lean();

      if (catDoc) match.category = catDoc._id;
    }
  }

  const pipeline = [
    { $match: match },

    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryData"
      }
    },
    { $unwind: "$categoryData" },
    {
      $match: {
        "categoryData.active": true,
        "categoryData.isDeleted": { $ne: true }
      }
    },

    {
      $lookup: {
        from: "variants",
        localField: "variants",
        foreignField: "_id",
        as: "variantsFull"
      }
    },

    {
      $addFields: {
        minPrice: {
          $min: {
            $map: {
              input: "$variantsFull",
              as: "v",
              in: {
                $ifNull: ["$$v.salePrice", "$$v.price"]
              }
            }
          }
        }
      }
    }
  ];

  if (minPrice !== null || maxPrice !== null) {
    const priceMatch = {};
    if (minPrice !== null) priceMatch.$gte = minPrice;
    if (maxPrice !== null) priceMatch.$lte = maxPrice;
    pipeline.push({ $match: { minPrice: priceMatch } });
  }

  const sortStage = {};
  if (sort === "price-asc") sortStage.minPrice = 1;
  else if (sort === "price-desc") sortStage.minPrice = -1;
  else if (sort === "a-z") sortStage.name = 1;
  else if (sort === "z-a") sortStage.name = -1;
  else sortStage.createdAt = -1;

  pipeline.push({ $sort: sortStage });

  pipeline.push({
    $facet: {
      results: [{ $skip: skip }, { $limit: limit }],
      totalCount: [{ $count: "count" }]
    }
  });

  const aggOut = await productModel.aggregate(pipeline).exec();
  const results = aggOut?.[0]?.results || [];
  const totalCount = aggOut?.[0]?.totalCount?.[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const products = [];

  for (const p of results) {
    let imgs = Array.isArray(p.images)
      ? p.images.filter(Boolean).map(normImage)
      : [];

    imgs = imgs.slice(0, 3);
    while (imgs.length < 3) imgs.push(null);

    const basePrice = p.minPrice || null;

    let offer = null;

    if (basePrice) {
      const bestOffer = await getBestOfferForProduct({
        _id: p._id,
        category: p.category,
        price: basePrice
      });

      if (bestOffer) {
        let discountAmount =
          bestOffer.discountType === "percentage"
            ? (basePrice * bestOffer.discountValue) / 100
            : bestOffer.discountValue;

        if (bestOffer.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, bestOffer.maxDiscountAmount);
        }

        offer = {
          title: bestOffer.title,
          discountAmount,
          finalPrice: Math.max(basePrice - discountAmount, 0)
        };
      }
    }

    products.push({
      _id: p._id,
      name: p.name,
      description: p.description,
      images: imgs,
      minPrice: basePrice,
      offer,
      category: p.category
    });
  }

  const categories = categoryModel
    ? await categoryModel.find({
        active: true,
        isDeleted: { $ne: true }
      }).sort({ name: 1 }).lean()
    : [];

  return {
    products,
    categories,
    currentPage,
    totalPages,
    totalCount
  };
};
