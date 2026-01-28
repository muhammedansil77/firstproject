
import mongoose from 'mongoose';
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Variant from "../../models/Variant.js";
import {
  upload,
  processProductImages,
  processVariantImage
} from "../../middlewares/upload.js";
import path from 'path';
import fs from 'fs';

function safeUnlink(filepath) {
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch (e) {
  
  }
}
import cloudinary from '../../config/cloudinary.js';
function getCloudinaryPublicId(url) {
  if (!url || !url.includes('cloudinary.com')) return null;

  // Remove version + extension
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

export const renderManageProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false })
      .populate({ path: 'category', select: 'name' })
      .populate({
        path: 'variants',
        select: 'images color stock price salePrice isListed'
      })
      .sort({ createdAt: -1 })
      .lean();

    const categories = await Category.find({})
      .sort({ name: 1 })
      .lean()
      .catch(() => []);

    return res.render("admin/product", {
      layout: "admin/layouts/main",
      title: "Product Management",
      products,
      categories,
      pageJS: "product.js",
      cssFile: '/admin/css/product.css' 
    });
  } catch (err) {
    console.error("renderManageProducts error:", err);
    return res.status(500).send("Error rendering product page");
  }
};

export async function listProducts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
    const q = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const status = (req.query.status || '').trim();
    const sort = (req.query.sort || '').trim(); 

    const filter = { isDeleted: false };

    
    if (status && status !== 'all') {
     
      if (!['name_asc', 'name_desc', 'newest', 'oldest', 'price_low', 'price_high'].includes(status)) {
        filter.status = status;
      }
    }


    if (q) {
      filter.$or = [
        { name: { $regex: escapeRegex(q), $options: 'i' } },
        { description: { $regex: escapeRegex(q), $options: 'i' } }
      ];
    }
     
    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = new mongoose.Types.ObjectId(category);
      } else {
        let resolved = null;
        try {
          resolved = await Category.findOne(
            { name: { $regex: '^' + escapeRegex(category) + '$', $options: 'i' } },
            { _id: 1 }
          ).lean();
        } catch (e) {
          console.warn('listProducts: category resolve error', e && e.message);
        }
        if (resolved && resolved._id) {
          filter.category = resolved._id;
        } else {
          filter.category = { $regex: '^' + escapeRegex(category) + '$', $options: 'i' };
        }
      }
    }
  // const menCategory = await Category.findOne({name:"Men"}).lean();
  // if(menCategory){
  //   filter.category=menCategory._id;
  // }
    const skip = (page - 1) * limit;

   
    let sortOption = { createdAt: -1 }; 
    
    switch(sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'name_asc':
        sortOption = { name: 1 };
        break;
      case 'name_desc':
        sortOption = { name: -1 };
        break;
      case 'price_low':
        sortOption = { 'variants.price': 1 };
        break;
      case 'price_high':
        sortOption = { 'variants.price': -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

  
    if (['name_asc', 'name_desc', 'newest', 'oldest', 'price_low', 'price_high'].includes(status)) {
  
      switch(status) {
        case 'name_asc':
          sortOption = { name: 1 };
          break;
        case 'name_desc':
          sortOption = { name: -1 };
          break;
        case 'newest':
          sortOption = { createdAt: -1 };
          break;
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'price_low':
          sortOption = { 'variants.price': 1 };
          break;
        case 'price_high':
          sortOption = { 'variants.price': -1 };
          break;
      }
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate({ path: 'category', select: 'name' })
        .populate({
          path: 'variants',
          select: 'images color stock price salePrice isListed'
        })
        .sort(sortOption) 
        .skip(skip)
        .limit(limit)
        .sort(sortOption)
        .lean()
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      success: true,
      products,
      pagination: {
        total,
        page,
        pages,
        limit
      }
    });

  } catch (err) {
    console.error('listProducts (paginated) error:', err);
    return res.status(500).json({ success: false, message: 'Server error listing products' });
  }
}

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Fetching product for edit:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID' 
      });
    }

  
    const product = await Product.findById(id)
      .populate('category', 'name _id')
      .populate({
        path: 'variants',
        select: 'images color stock price salePrice isListed'
      })
      .lean();

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    console.log('Product found:', product.name, 'Variants:', product.variants?.length);

    return res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        description: product.description || '',
        category: product.category,
        images: product.images || [],
        variants: product.variants || [],
        status: product.status || 'active',
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    });

  } catch (err) {
    console.error('getProduct error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error fetching product',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
export const renderCreateProductPage = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
     let product = null;

  // 👇 THIS IS THE KEY
  if (req.params.id) {
    product = await Product.findById(req.params.id)
      .populate('variants')
      .lean();
  }

    return res.render('admin/create', {
      layout: 'admin/layouts/main',
      title: 'Add Product',
      categories,
         product,
      pageJS: 'product-create.js',
      // optional (reuse existing)
    });

  } catch (err) {
    console.error('renderCreateProductPage error:', err);

    return res.status(500).render('admin/error', {
      layout: 'admin/layouts/main',
      title: 'Error',
      message: 'Failed to load create product page'
    });
  }
};
export const renderEditProductPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category')
      .populate('variants')
      .lean();

    if (!product) return res.status(404).render('admin/404');

    const categories = await Category.find({
      active: true,
      isDeleted: false
    })
    .sort({ name: 1 })
    .lean();

    res.render('admin/edit', {
      title: 'Edit Product',
      product,
      categories,
      pageJS: 'product-edit.js'
    });

  } catch (err) {
    console.error('renderEditProductPage error:', err);
    res.status(500).send('Server error');
  }
};





export const createProduct = async (req, res) => {
  try {
    const { name, description, category } = req.body;

    /* ===============================
       PRODUCT VALIDATION
    =============================== */
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        errors: { name: 'Product name is required' }
      });
    }

    const exists = await Product.findOne({
      name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
      isDeleted: false
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        errors: { name: 'Product with this name already exists' }
      });
    }

    const variantsInput = req.body.variants || {};

    const variantIndices = Object.keys(variantsInput);

    if (!variantIndices.length) {
      return res.status(400).json({
        success: false,
        errors: {
          variants: { _form: 'At least one variant is required' }
        }
      });
    }

    /* ===============================
       VARIANT VALIDATION (NO DB WRITE)
    =============================== */
    for (const idx of variantIndices) {
      const v = variantsInput[idx];

      if (!v.color || !v.color.trim()) {
        return res.status(400).json({
          success: false,
          errors: { variants: { [idx]: { color: 'Color is required' } } }
        });
      }

      const stock = Number(v.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          errors: { variants: { [idx]: { stock: 'Stock cannot be negative' } } }
        });
      }

      const price = Number(v.price);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          errors: { variants: { [idx]: { price: 'Price must be greater than 0' } } }
        });
      }
    }
const allFiles = Array.isArray(req.files)
  ? req.files
  : Object.values(req.files || {}).flat();

const variantFilesMap = {};

for (const file of allFiles) {
  const match = file.fieldname.match(/^variants\[(\d+)\]\[image\]/);
  if (!match) continue;

  const idx = match[1];
  variantFilesMap[idx] = variantFilesMap[idx] || [];
  variantFilesMap[idx].push(file);
}
for (const idx of variantIndices) {
  const files = variantFilesMap[idx] || [];

  if (files.length < 3) {
    return res.status(400).json({
      success: false,
      errors: {
        variants: {
          [idx]: { images: 'Minimum 3 images required' }
        }
      }
    });
  }
}


    /* ===============================
       CREATE PRODUCT
    =============================== */
    const product = await Product.create({
      name: name.trim(),
      description: description || '',
      category: category || null
    });

    /* ===============================
       CREATE VARIANTS
    =============================== */
  const createdVariantIds = [];

for (const idx of variantIndices) {
  const v = variantsInput[idx];
  const files = variantFilesMap[idx] || [];

  const imagePaths = [];
  for (const file of files) {
    const savedPath = await processVariantImage(file); // your existing helper
    if (savedPath) imagePaths.push(savedPath);
  }

  const variant = await Variant.create({
    product: product._id,
    color: v.color.trim(),
    stock: Number(v.stock),
    price: Number(v.price),
    salePrice: v.salePrice ? Number(v.salePrice) : null,
    images: imagePaths, // ✅ NOW IMAGES ARE SAVED
    isListed: true
  });

  createdVariantIds.push(variant._id);
}


    /* ===============================
       LINK VARIANTS TO PRODUCT
    =============================== */
    await Product.updateOne(
      { _id: product._id },
      { $set: { variants: createdVariantIds } }
    );

    return res.json({
      success: true,
      message: 'Product created successfully'
    });

  } catch (err) {
    console.error('createProduct error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating product'
    });
  }
};


export const deleteProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imagePath, variantId } = req.body;

    if (!productId || !imagePath) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

  
    const publicId = getCloudinaryPublicId(imagePath);

    if (variantId) {
      const variant = await Variant.findOne({ _id: variantId, product: productId });
      if (!variant) {
        return res.status(404).json({ success: false, message: 'Variant not found' });
      }

     
      variant.images = variant.images.filter(img => img !== imagePath);
      await variant.save();
    } else {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

    
      product.images = product.images.filter(img => img !== imagePath);
      await product.save();
    }

    
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      console.log('Deleted from Cloudinary:', publicId);
    }

    return res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (err) {
    console.error('Delete image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting image'
    });
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const variantId = req.params.id;

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.json({ success: true }); // already deleted
    }

 
    for (const img of variant.images) {
      const publicId = getCloudinaryPublicId(img);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // 🔥 remove variant reference from product
    await Product.findByIdAndUpdate(
      variant.product,
      { $pull: { variants: variant._id } }
    );

    // 🔥 delete variant
    await Variant.findByIdAndDelete(variantId);

    res.json({ success: true });

  } catch (err) {
    console.error('Delete variant error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete variant'
    });
  }
};

export async function patchProduct(req, res) {
  try {

    
    console.log('REQ BODY KEYS:', Object.keys(req.body));
console.log('REQ FILES:', req.files?.map(f => f.fieldname));
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product id required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // ✅ PRODUCT NAME VALIDATION
if (!req.body.name || !req.body.name.trim()) {
  return res.status(400).json({
    success: false,
    message: 'Product name is required'
  });
}


  
    const { name, description, category } = req.body;

    if (name !== undefined && name.trim() !== '') {
      product.name = name.trim();
    }
    
    if (description !== undefined) {
      product.description = description;
    }

  // ✅ CATEGORY VALIDATION
if (!category) {
  return res.status(400).json({
    success: false,
    message: 'Category is required'
  });
}

const categoryDoc = await Category.findOne({
  _id: category,
  active: true,
  isDeleted: false
});

if (!categoryDoc) {
  return res.status(400).json({
    success: false,
    message: 'Invalid or inactive category'
  });
}

product.category = categoryDoc._id;



    const allFilesFlat = Array.isArray(req.files) ? req.files : (req.files ? Object.values(req.files).flat() : []);
    const productFiles = allFilesFlat.filter(f => ['images', 'images[]', 'productImages', 'productImages[]'].includes(f.fieldname));
    
    if (productFiles.length > 0) {
      const newImages = [];
      for (const f of productFiles) {
        try {
         const saved = await processProductImages([f]);
if (saved && saved[0]) {
  newImages.push(saved[0]); 
}
        } catch (e) {
          console.warn('Failed to process product image:', e.message);
        }
      }
      if (newImages.length) {
        product.images = [...product.images, ...newImages];
      }
    }

   
    await product.save();

  /* ===============================
   NORMALIZE VARIANTS INPUT
=============================== */
let variantsInput = {};

if (req.body.variants && typeof req.body.variants === 'object') {
  // ✅ THIS IS YOUR CASE (EDIT)
  variantsInput = req.body.variants;
} else {
  // fallback (flat keys)
  for (const key in req.body) {
    const m = key.match(/^variants\[(\d+)\]\[(.+)\]$/);
    if (!m) continue;

    const idx = m[1];
    const field = m[2];

    variantsInput[idx] = variantsInput[idx] || {};
    variantsInput[idx][field] = req.body[key];
  }
}

/* ===============================
   MAP VARIANT FILES
=============================== */
const variantFilesMap = {};

allFilesFlat.forEach(file => {
  const m = file.fieldname.match(/^variants\[(\d+)\]\[image\]/);
  if (!m) return;

  const idx = m[1];
  variantFilesMap[idx] = variantFilesMap[idx] || [];
  variantFilesMap[idx].push(file);
});

/* ===============================
   CREATE / UPDATE VARIANTS
=============================== */
for (const idx of Object.keys(variantsInput)) {
  const v = variantsInput[idx];
  let variant;
const humanIndex = Number(idx) + 1;

// ✅ COLOR
if (!v.color || !v.color.trim()) {
  return res.status(400).json({
    success: false,
    message: `Variant ${humanIndex}: Color is required`
  });
}

// ✅ STOCK
const stock = Number(v.stock);
if (!Number.isInteger(stock) || stock < 0) {
  return res.status(400).json({
    success: false,
    message: `Variant ${humanIndex}: Stock must be 0 or more`
  });
}

// ✅ PRICE
const price = Number(v.price);
if (isNaN(price) || price <= 0) {
  return res.status(400).json({
    success: false,
    message: `Variant ${humanIndex}: Price must be greater than 0`
  });
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


  // ADD IMAGES
  const files = variantFilesMap[idx] || [];
  // ✅ IMAGE COUNT VALIDATION (MIN 3)
const existingImages = variant.images.length;
const newImages = files.length;

if (existingImages + newImages < 3) {
  return res.status(400).json({
    success: false,
    message: `Variant ${humanIndex}: Minimum 3 images required`
  });
}

  for (const file of files) {
    const saved = await processVariantImage(file);
    if (saved) variant.images.push(saved);
  }

  await variant.save();
}

// save product once
await product.save();



  
   

 
 

 
    const updated = await Product.findById(productId)
      .populate('category')
      .populate('variants')
      .lean();

    return res.json({
      success: true,
      message: 'Product & variants updated successfully',
      product: updated
    });

  } catch (err) {
    console.error('PATCH PRODUCT ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: err.message
    });
  }
}

export const blockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByIdAndUpdate(
      id,
      { 
        status: 'blocked',
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Product blocked successfully',
      product 
    });
  } catch (err) {
    console.error('blockProduct error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error blocking product' 
    });
  }
};


export const unblockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByIdAndUpdate(
      id,
      { 
        status: 'active',
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Product unblocked successfully',
      product 
    });
  } catch (err) {
    console.error('unblockProduct error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error unblocking product' 
    });
  }
};


export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    const newStatus = product.status === 'active' ? 'blocked' : 'active';
    product.status = newStatus;
    product.updatedAt = Date.now();
    await product.save();

    return res.json({ 
      success: true, 
      message: `Product ${newStatus === 'active' ? 'unblocked' : 'blocked'} successfully`,
      status: newStatus,
      product 
    });
  } catch (err) {
    console.error('toggleProductStatus error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error toggling product status' 
    });
  }
};