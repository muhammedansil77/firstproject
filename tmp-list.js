// tmp-list.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

// ===== IMPORT MODELS (FIX PATHS IF NEEDED) =====
import Product from './models/Product.js';
import Variant from './models/Variant.js';

// ===== CLOUDINARY CONFIG =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== SAFETY CHECKS =====
if (!process.env.MONGODB_URL) {
  throw new Error('❌ MONGODB_URL missing in .env');
}

// ===== CONNECT DB =====
await mongoose.connect(process.env.MONGODB_URL);
console.log('✅ MongoDB connected');

// ===== HELPERS =====
const PUBLIC_DIR = path.join(process.cwd(), 'public');

function isCloudinary(url) {
  return typeof url === 'string' && url.includes('cloudinary.com');
}

async function uploadLocalImage(relPath, folder) {
  const absolutePath = path.join(PUBLIC_DIR, relPath);

  if (!fs.existsSync(absolutePath)) {
    console.warn('⚠ File not found:', relPath);
    return null;
  }

  const res = await cloudinary.uploader.upload(absolutePath, {
    folder
  });

  console.log('☁ Uploaded:', relPath, '→', res.secure_url);
  return res.secure_url;
}

// ===== MAIN MIGRATION =====
async function migrateImages() {
  const products = await Product.find({}).populate('variants');

  console.log(`🔍 Found ${products.length} products`);

  for (const product of products) {
    let productChanged = false;

    // ---------- PRODUCT IMAGES ----------
    if (Array.isArray(product.images)) {
      for (let i = 0; i < product.images.length; i++) {
        const img = product.images[i];

        if (!isCloudinary(img)) {
          const newUrl = await uploadLocalImage(img, 'products');
          if (newUrl) {
            product.images[i] = newUrl;
            productChanged = true;
          }
        }
      }
    }

    if (productChanged) {
      await product.save();
      console.log(`✅ Product updated: ${product.name}`);
    }

    // ---------- VARIANT IMAGES ----------
    for (const variant of product.variants) {
      let variantChanged = false;

      if (Array.isArray(variant.images)) {
        for (let i = 0; i < variant.images.length; i++) {
          const img = variant.images[i];

          if (!isCloudinary(img)) {
            const newUrl = await uploadLocalImage(img, 'variants');
            if (newUrl) {
              variant.images[i] = newUrl;
              variantChanged = true;
            }
          }
        }
      }

      if (variantChanged) {
        await variant.save();
        console.log(`✅ Variant updated: ${variant._id}`);
      }
    }
  }

  console.log('🎉 MIGRATION COMPLETE');
  process.exit(0);
}

// ===== RUN =====
migrateImages().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
