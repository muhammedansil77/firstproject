import mongoose from 'mongoose';
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Variant from "../models/Variant.js";

import path from 'path';
import fs from 'fs';

function safeUnlink(filepath) {
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch (e) {
  
  }
}
import {
  upload,
  processProductImages,
  processVariantImage
} from "../middlewares/upload.js";
import cloudinary from '../config/cloudinary.js';
function getCloudinaryPublicId(url) {
  if (!url || !url.includes('cloudinary.com')) return null;


  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');

  if (uploadIndex === -1) return null;

  const publicPath = parts
    .slice(uploadIndex + 1)
    .join('/')
    .replace(/^v\d+\//, '')
    .replace(/\.[^/.]+$/, '');

  return publicPath;
}



function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const listProductsService = async (queryParams) => {
  const page = Math.max(1, parseInt(queryParams.page || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit || "10", 10)));

  const q = (queryParams.q || "").trim();
  const category = (queryParams.category || "").trim();
  const status = (queryParams.status || "").trim();
  const sort = (queryParams.sort || "").trim();

  const filter = { isDeleted: false };


  if (status && status !== "all") {
    if (!["name_asc", "name_desc", "newest", "oldest", "price_low", "price_high"].includes(status)) {
      filter.status = status;
    }
  }


  if (q) {
    filter.$or = [
      { name: { $regex: escapeRegex(q), $options: "i" } },
      { description: { $regex: escapeRegex(q), $options: "i" } }
    ];
  }


  if (category && category !== "all") {
    if (mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    } else {
      let resolved = null;

      try {
        resolved = await Category.findOne(
          { name: { $regex: "^" + escapeRegex(category) + "$", $options: "i" } },
          { _id: 1 }
        ).lean();
      } catch (e) {
        console.warn("listProductsService: category resolve error", e?.message);
      }

      if (resolved && resolved._id) {
        filter.category = resolved._id;
      } else {
        filter.category = { $regex: "^" + escapeRegex(category) + "$", $options: "i" };
      }
    }
  }
// const menCategory = await Category.findOne({name:"Men"}).lean(); // if(menCategory){ // filter.category=menCategory._id; // }
  const skip = (page - 1) * limit;


  let sortOption = { createdAt: -1 };


  switch (sort) {
    case "newest":
      sortOption = { createdAt: -1 };
      break;
    case "oldest":
      sortOption = { createdAt: 1 };
      break;
    case "name_asc":
      sortOption = { name: 1 };
      break;
    case "name_desc":
      sortOption = { name: -1 };
      break;
    case "price_low":
      sortOption = { "variants.price": 1 };
      break;
    case "price_high":
      sortOption = { "variants.price": -1 };
      break;
    default:
      sortOption = { createdAt: -1 };
  }


  if (["name_asc", "name_desc", "newest", "oldest", "price_low", "price_high"].includes(status)) {
    switch (status) {
      case "name_asc":
        sortOption = { name: 1 };
        break;
      case "name_desc":
        sortOption = { name: -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "price_low":
        sortOption = { "variants.price": 1 };
        break;
      case "price_high":
        sortOption = { "variants.price": -1 };
        break;
    }
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .populate({ path: "category", select: "name" })
      .populate({
        path: "variants",
        select: "images color stock price salePrice isListed"
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return {
    products,
    pagination: {
      total,
      page,
      pages,
      limit
    }
  };
};
export const createProductService = async (body, files) => {
  const { name, description, category } = body;

 
  if (!name || !name.trim()) {
    throw new Error("Product name is required");
  }

  const exists = await Product.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, "i"),
    isDeleted: false
  });

  if (exists) {
    throw new Error("Product with this name already exists");
  }


  const variantsInput = body.variants || {};
  const variantIndices = Object.keys(variantsInput);

  if (!variantIndices.length) {
    throw new Error("At least one variant is required");
  }

 
  for (const idx of variantIndices) {
    const v = variantsInput[idx];

    if (!v.color || !v.color.trim()) {
      throw new Error(`Color is required for variant ${idx}`);
    }

    const stock = Number(v.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error(`Stock cannot be negative for variant ${idx}`);
    }

    const price = Number(v.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Price must be greater than 0 for variant ${idx}`);
    }
  }


  const allFiles = Array.isArray(files)
    ? files
    : Object.values(files || {}).flat();

  const variantFilesMap = {};

  for (const file of allFiles) {
    const match = file.fieldname.match(/^variants\[(\d+)\]\[image\]/);
    if (!match) continue;

    const idx = match[1];
    variantFilesMap[idx] = variantFilesMap[idx] || [];
    variantFilesMap[idx].push(file);
  }


  for (const idx of variantIndices) {
    const variantFiles = variantFilesMap[idx] || [];

    if (variantFiles.length < 3) {
      throw new Error(`Minimum 3 images required for variant ${idx}`);
    }
  }


  const product = await Product.create({
    name: name.trim(),
    description: description || "",
    category: category || null
  });


  const createdVariantIds = [];

  for (const idx of variantIndices) {
    const v = variantsInput[idx];
    const variantFiles = variantFilesMap[idx] || [];

    const imagePaths = [];
    for (const file of variantFiles) {
      const savedPath = await processVariantImage(file);
      if (savedPath) imagePaths.push(savedPath);
    }

    const variant = await Variant.create({
      product: product._id,
      color: v.color.trim(),
      stock: Number(v.stock),
      price: Number(v.price),
      salePrice: v.salePrice ? Number(v.salePrice) : null,
      images: imagePaths,
      isListed: true
    });

    createdVariantIds.push(variant._id);
  }


  await Product.updateOne(
    { _id: product._id },
    { $set: { variants: createdVariantIds } }
  );

  return product;
};
export const patchProductService = async (productId, body, files) => {
  if (!productId) {
    throw new Error("Product id required");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Product not found");
  }


  if (!body.name || !body.name.trim()) {
    throw new Error("Product name is required");
  }

  const { name, description, category } = body;

  if (name !== undefined && name.trim() !== "") {
    product.name = name.trim();
  }

  if (description !== undefined) {
    product.description = description;
  }


  if (!category) {
    throw new Error("Category is required");
  }

  const categoryDoc = await Category.findOne({
    _id: category,
    active: true,
    isDeleted: false
  });

  if (!categoryDoc) {
    throw new Error("Invalid or inactive category");
  }

  product.category = categoryDoc._id;

  // ----------------------------
  // FILE NORMALIZATION
  // ----------------------------
  const allFilesFlat = Array.isArray(files)
    ? files
    : files
    ? Object.values(files).flat()
    : [];

  // ----------------------------
  // PRODUCT IMAGE UPLOAD
  // ----------------------------
  const productFiles = allFilesFlat.filter((f) =>
    ["images", "images[]", "productImages", "productImages[]"].includes(f.fieldname)
  );

  if (productFiles.length > 0) {
    const newImages = [];

    for (const f of productFiles) {
      try {
        const saved = await processProductImages([f]);
        if (saved && saved[0]) newImages.push(saved[0]);
      } catch (e) {
        console.warn("Failed to process product image:", e.message);
      }
    }

    if (newImages.length) {
      product.images = [...product.images, ...newImages];
    }
  }

  // Save product once after basic update
  await product.save();

  // ----------------------------
  // NORMALIZE VARIANTS INPUT
  // ----------------------------
  let variantsInput = {};

  if (body.variants && typeof body.variants === "object") {
    variantsInput = body.variants;
  } else {
    for (const key in body) {
      const m = key.match(/^variants\[(\d+)\]\[(.+)\]$/);
      if (!m) continue;

      const idx = m[1];
      const field = m[2];

      variantsInput[idx] = variantsInput[idx] || {};
      variantsInput[idx][field] = body[key];
    }
  }

  // ----------------------------
  // MAP VARIANT FILES
  // ----------------------------
  const variantFilesMap = {};

  allFilesFlat.forEach((file) => {
    const m = file.fieldname.match(/^variants\[(\d+)\]\[image\]/);
    if (!m) return;

    const idx = m[1];
    variantFilesMap[idx] = variantFilesMap[idx] || [];
    variantFilesMap[idx].push(file);
  });

  // ----------------------------
  // CREATE / UPDATE VARIANTS
  // ----------------------------
  for (const idx of Object.keys(variantsInput)) {
    const v = variantsInput[idx];
    let variant;

    const humanIndex = Number(idx) + 1;

    // COLOR VALIDATION
    if (!v.color || !v.color.trim()) {
      throw new Error(`Variant ${humanIndex}: Color is required`);
    }

    // STOCK VALIDATION
    const stock = Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`Variant ${humanIndex}: Stock must be 0 or more`);
    }

    // PRICE VALIDATION
    const price = Number(v.price);
    if (isNaN(price) || price <= 0) {
      throw new Error(`Variant ${humanIndex}: Price must be greater than 0`);
    }

    // EXISTING VARIANT
    if (v._id && mongoose.Types.ObjectId.isValid(v._id)) {
      variant = await Variant.findById(v._id);
      if (!variant) continue;
    }
    // NEW VARIANT
    else {
      variant = new Variant({
        product: productId,
        images: []
      });

      if (!product.variants.includes(variant._id)) {
        product.variants.push(variant._id);
      }
    }

    variant.color = v.color.trim();
    variant.stock = stock;
    variant.price = price;
    variant.salePrice = v.salePrice ? Number(v.salePrice) : null;
    variant.isListed = stock > 0;

    // IMAGE COUNT VALIDATION (MIN 3)
    const files = variantFilesMap[idx] || [];
    const existingImages = variant.images.length;
    const newImages = files.length;

    if (existingImages + newImages < 3) {
      throw new Error(`Variant ${humanIndex}: Minimum 3 images required`);
    }

    // ADD IMAGES
    for (const file of files) {
      const saved = await processVariantImage(file);
      if (saved) variant.images.push(saved);
    }

    await variant.save();
  }


  await product.save();


  const updated = await Product.findById(productId)
    .populate("category")
    .populate("variants")
    .lean();

  return updated;
};