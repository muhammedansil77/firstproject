
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


export const createProduct = async (req, res) => {
  
  function safeUnlinkRel(relPath) {
    try {
      if (!relPath) return;
      const p = path.join(process.cwd(), 'public', String(relPath));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('safeUnlinkRel error', e && e.message);
    }
  }

  try {
    console.log('createProduct: entry - req.body keys:', Object.keys(req.body || {}));

   
    const allFilesFlat = Array.isArray(req.files) ? req.files : (req.files ? Object.values(req.files).flat() : []);
    console.log('createProduct: total uploaded file count:', allFilesFlat.length, 'files:', allFilesFlat.map(f => f.fieldname));

    const { name, description, category } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name required' });

  
    const productFiles = allFilesFlat.filter(f => ['productImages', 'productImages[]','images','images[]'].includes(f.fieldname));
    const variantFiles = allFilesFlat.filter(f => (f.fieldname || '').match(/^variants\[(\d+)\]\[image\](?:\[\])?$/));


    const variantFilesMap = {};
    for (const f of variantFiles) {
      const m = f.fieldname.match(/^variants\[(\d+)\]\[image\](?:\[\])?$/);
      if (!m) continue;
      const idx = String(m[1]);
      variantFilesMap[idx] = variantFilesMap[idx] || [];
      variantFilesMap[idx].push(f);
    }
    console.log('createProduct: variantFilesMap keys=', Object.keys(variantFilesMap));

  
    let variantsPayload = [];
    if (req.body.variants) {
      try { variantsPayload = (typeof req.body.variants === 'string') ? JSON.parse(req.body.variants) : req.body.variants; }
      catch (e) { variantsPayload = []; }
    }
    console.log('createProduct: variantsPayload length=', (variantsPayload && variantsPayload.length) ? variantsPayload.length : 0);

  
    const variantMap = {};
    for (const k of Object.keys(req.body || {})) {
      const m = k.match(/^variants\[(\d+)\]\[(color|stock|price|salePrice|isListed|image)\]$/);
      if (m) {
        const idx = String(m[1]), field = m[2];
        variantMap[idx] = variantMap[idx] || {};
        variantMap[idx][field] = req.body[k];
      }
    }
    console.log('createProduct: variantMap keys=', Object.keys(variantMap));

  
const indicesSet = new Set();


Object.keys(variantFilesMap).forEach(k => indicesSet.add(String(k)));


Object.keys(variantMap).forEach(k => indicesSet.add(String(k)));


if (Array.isArray(variantsPayload)) {
  for (let i = 0; i < variantsPayload.length; i++) {
    if (indicesSet.has(String(i))) indicesSet.add(String(i));
  }
}

const variantIndices = Array.from(indicesSet).sort((a,b)=>Number(a)-Number(b));
console.log('SAFE variantIndices:', variantIndices);



    const savedVariantPathsMap = {};
    const tempSavedFilesForCleanup = []; 

   
    async function processFilesForVariant(idx) {
  const uploadedFiles = variantFilesMap[idx] || [];
  const saved = [];
  for (const f of uploadedFiles) {
    const savedPath = await processVariantImage(f);
    if (savedPath) {
      saved.push(savedPath); // ✅ SAVE CLOUDINARY URL DIRECTLY
    }
  }
  return saved;
}


    
    let savedProductFilenames = [];
    if (productFiles.length > 0) {
      try {
       const saved = await processProductImages(productFiles);
savedProductFilenames = saved;
        savedProductFilenames.forEach(p => tempSavedFilesForCleanup.push(p));
        console.log('createProduct: savedProductFilenames=', savedProductFilenames);
      } catch (e) {
        console.warn('createProduct: processProductImages failed - continuing without them:', e && e.message);
      }
    }


    for (const idx of variantIndices) {
      const savedPaths = [];


      const processed = await processFilesForVariant(idx);
      processed.forEach(p => savedPaths.push(p));

     
      const payloadEntry = (Array.isArray(variantsPayload) && typeof variantsPayload[Number(idx)] !== 'undefined') ? variantsPayload[Number(idx)] : null;
      const mapEntry = variantMap[idx] || {};
      const mergedEntry = Object.assign({}, mapEntry, payloadEntry || {});

      if (mergedEntry.image) {
        if (Array.isArray(mergedEntry.image)) {
          mergedEntry.image.forEach(im => {
            if (!im) return;
            const s = String(im).trim();
            if (/^https?:\/\//i.test(s)) savedPaths.push(s);
            else savedPaths.push(s.replace(/^\/+/, '').replace(/\\/g, '/'));
          });
        } else if (typeof mergedEntry.image === 'string' && mergedEntry.image) {
          const s = mergedEntry.image.trim();
          if (/^https?:\/\//i.test(s)) savedPaths.push(s);
          else savedPaths.push(s.replace(/^\/+/, '').replace(/\\/g, '/'));
        }
      }

      if (!savedPaths.length && savedProductFilenames.length) {
        const start = Math.max(0, Number(idx));
        for (let j = 0; j < 3 && (start + j) < savedProductFilenames.length; j++) savedPaths.push(savedProductFilenames[start + j]);
      }

      savedVariantPathsMap[idx] = savedPaths;
      console.log(`createProduct: prepared savedVariantPathsMap[${idx}] length=${savedPaths.length}`);
    }

   
    for (const idx of variantIndices) {
      const arr = savedVariantPathsMap[idx] || [];
      if (!arr.length) {
   
        tempSavedFilesForCleanup.forEach(p => safeUnlinkRel(p));
        return res.status(400).json({ success: false, message: `No images provided for variant ${idx}. Each variant must have at least 3 images.`, got: arr });
      }
      if (arr.length < 3) {
        tempSavedFilesForCleanup.forEach(p => safeUnlinkRel(p));
        return res.status(400).json({ success: false, message: `Variant ${idx} needs at least 3 images. Provided ${arr.length}.`, got: arr });
      }
    }


    let categoryForSave = null;
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) categoryForSave = new mongoose.Types.ObjectId(category);
      else {
        try {
          const catDoc = await Category.findOne({ name: { $regex: '^' + escapeRegex(category) + '$', $options: 'i' } }, { _id:1 }).lean();
          if (catDoc && catDoc._id) categoryForSave = catDoc._id;
        } catch (e) { console.warn('createProduct: category lookup failed', e && e.message); }
      }
    }

    const prod = await Product.create({
      name: name.trim(),
      description: description || '',
      category: categoryForSave,
      images: savedProductFilenames
    });
    console.log('createProduct: created product', prod._id?.toString());

  
    const createdVariantIds = [];
    for (const idx of variantIndices) {
      try {
        const payloadEntry = (Array.isArray(variantsPayload) && typeof variantsPayload[Number(idx)] !== 'undefined') ? variantsPayload[Number(idx)] : null;
        const mapEntry = variantMap[idx] || {};
        const v = Object.assign({}, mapEntry, payloadEntry || {});

            const imgs = savedVariantPathsMap[idx] || [];
        const stockNum = (typeof v.stock !== 'undefined' && v.stock !== null && v.stock !== '') ? Number(v.stock) : 0;
        const priceNum = (typeof v.price !== 'undefined' && v.price !== null && v.price !== '') ? Number(v.price) : null;
        const salePriceNum = (typeof v.salePrice !== 'undefined' && v.salePrice !== null && v.salePrice !== '') ? Number(v.salePrice) : null;
        const colorVal = (typeof v.color !== 'undefined' && v.color !== null && String(v.color).trim() !== '') ? v.color : null;

        const humanIdx = Number(idx) + 1;

        if (Number.isFinite(stockNum) && stockNum < 0) {
          tempSavedFilesForCleanup.forEach(p => safeUnlinkRel(p));
          return res.status(400).json({
            success: false,
            message: `Variant ${humanIdx}: stock cannot be negative`
          });
        }

        if (Number.isFinite(priceNum) && priceNum < 0) {
          tempSavedFilesForCleanup.forEach(p => safeUnlinkRel(p));
          return res.status(400).json({
            success: false,
            message: `Variant ${humanIdx}: price cannot be negative`
          });
        }


        let isListedFlag = false;
        if (typeof v.isListed !== 'undefined') {
          const raw = v.isListed;
          if (raw === true || raw === 'true' || raw === '1' || raw === 1) isListedFlag = true;
        } else {
          isListedFlag = (Number.isFinite(priceNum) && priceNum !== null && (Number.isFinite(stockNum) ? stockNum > 0 : false));
        }

        const created = await Variant.create({
          product: prod._id,
          images: imgs,
          stock: Number.isFinite(stockNum) ? stockNum : 0,
          color: colorVal,
          price: Number.isFinite(priceNum) ? priceNum : null,
          salePrice: Number.isFinite(salePriceNum) ? salePriceNum : null,
          isListed: !!isListedFlag
        });

        createdVariantIds.push(created._id);
      } catch (e) {
        console.error('createProduct: failed creating variant idx', idx, e && e.message);
      
        try { if (createdVariantIds.length) await Variant.deleteMany({ _id: { $in: createdVariantIds } }); } catch(e){/*ignore*/}
        try { await Product.deleteOne({ _id: prod._id }); } catch(e){/*ignore*/}
        tempSavedFilesForCleanup.forEach(p => safeUnlinkRel(p));
        return res.status(500).json({ success:false, message: 'Server error creating variants', error: String(e) });
      }
    }


    if (createdVariantIds.length) {
      await Product.updateOne({ _id: prod._id }, { $set: { variants: createdVariantIds } });
    }

    const saved = await Product.findById(prod._id).populate('variants').lean();
    console.log('createProduct: done - saved product variants count=', (saved.variants || []).length);
    return res.json({ success: true, product: saved });

  } catch (err) {
    console.error('createProduct error:', err && (err.stack || err));
    return res.status(500).json({ success:false, message:'Server error during product create', error: String(err) });
  }
};

export const deleteProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imagePath, variantId } = req.body;

    if (!productId || !imagePath) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 🔹 Extract Cloudinary public_id
    const publicId = getCloudinaryPublicId(imagePath);

    if (variantId) {
      const variant = await Variant.findOne({ _id: variantId, product: productId });
      if (!variant) {
        return res.status(404).json({ success: false, message: 'Variant not found' });
      }

      // ✅ EXACT MATCH (not includes)
      variant.images = variant.images.filter(img => img !== imagePath);
      await variant.save();
    } else {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      // ✅ EXACT MATCH
      product.images = product.images.filter(img => img !== imagePath);
      await product.save();
    }

    // ✅ DELETE FROM CLOUDINARY
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


export async function patchProduct(req, res) {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product id required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

  
    const { name, description, category } = req.body;

    if (name !== undefined && name.trim() !== '') {
      product.name = name.trim();
    }
    
    if (description !== undefined) {
      product.description = description;
    }

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        product.category = category;
      } else {
        const cat = await Category.findOne({
          name: new RegExp(`^${escapeRegex(category)}$`, 'i')
        });
        if (cat) {
          product.category = cat._id;
        }
      }
    }


    const allFilesFlat = Array.isArray(req.files) ? req.files : (req.files ? Object.values(req.files).flat() : []);
    const productFiles = allFilesFlat.filter(f => ['images', 'images[]', 'productImages', 'productImages[]'].includes(f.fieldname));
    
    if (productFiles.length > 0) {
      const newImages = [];
      for (const f of productFiles) {
        try {
         const saved = await processProductImages([f]);
if (saved && saved[0]) {
  newImages.push(saved[0]); // ✅ Cloudinary URL
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

  
    const variantsToUpdate = [];
    
    if (req.body.variants) {
      try {
        const variantsArray = typeof req.body.variants === 'string' 
          ? JSON.parse(req.body.variants) 
          : req.body.variants;
        
        if (Array.isArray(variantsArray)) {
          variantsToUpdate.push(...variantsArray);
        }
      } catch (e) {
        console.warn('Failed to parse variants array:', e.message);
      }
    }

  
    const variantFilesMap = {};
    allFilesFlat.forEach(file => {
      const match = file.fieldname && file.fieldname.match(/^variants\[(\d+)\]\[image\](?:\[\])?$/);
      if (match) {
        const idx = match[1];
        variantFilesMap[idx] = variantFilesMap[idx] || [];
        variantFilesMap[idx].push(file);
      }
    });

 
    for (const variantData of variantsToUpdate) {
      if (!variantData._id) {
        console.warn('Variant missing _id, skipping:', variantData);
        continue;
      }

      try {
        const variant = await Variant.findById(variantData._id);
        
        if (!variant) {
          console.warn(`Variant ${variantData._id} not found`);
          continue;
        }

       
        if (String(variant.product) !== String(productId)) {
          console.warn(`Variant ${variantData._id} does not belong to product ${productId}`);
          continue;
        }

        if (variantData.color !== undefined && variantData.color !== null && variantData.color.trim() !== '') {
          variant.color = variantData.color.trim();
        }
        
        if (variantData.stock !== undefined && variantData.stock !== null) {
  const stockNum = Number(variantData.stock);

  if (isNaN(stockNum)) {
    return res.status(400).json({
      success: false,
      message: 'Stock must be a valid number'
    });
  }

  // if (stockNum < 0) 
  // if(stockNum<0){
  //   return res.status(400).json({
  //     success:false,
  //     message:'hjdbhdbh00..'
  //   })
  // }

  variant.stock = stockNum;
}

        if (variantData.price !== undefined && variantData.price !== null) {
          const priceNum = Number(variantData.price);
          if (!isNaN(priceNum) && priceNum >= 0) {
            variant.price = priceNum;
          }
        }
        
        if (variantData.salePrice !== undefined && variantData.salePrice !== null) {
          const salePriceNum = Number(variantData.salePrice);
          if (!isNaN(salePriceNum) && salePriceNum >= 0) {
            variant.salePrice = salePriceNum;
          } else {
            variant.salePrice = null;
          }
        }
        
        if (variantData.isListed !== undefined) {
          variant.isListed = variantData.isListed === true || variantData.isListed === 'true' || variantData.isListed === 1;
        }
       
        
        const variantIndex = variantsToUpdate.indexOf(variantData);
        if (variantFilesMap[variantIndex] && variantFilesMap[variantIndex].length > 0) {
          const newImages = [];
          for (const file of variantFilesMap[variantIndex]) {
            try {
             const saved = await processVariantImage(file);
if (saved) {
  newImages.push(saved); // ✅ Cloudinary URL
}
            } catch (e) {
              console.warn(`Failed to process variant image:`, e.message);
            }
          }
          if (newImages.length > 0) {
            variant.images = [...variant.images, ...newImages];
          }
        }
// ✅ DELETE VARIANT IMAGES (CLOUDINARY + DB)
if (variantData.deletedImages) {
  let deletedImages = [];

  try {
    deletedImages = JSON.parse(variantData.deletedImages);
  } catch (e) {
    deletedImages = [];
  }

  if (Array.isArray(deletedImages) && deletedImages.length > 0) {
    for (const imgUrl of deletedImages) {
      // Remove from DB
      variant.images = variant.images.filter(img => img !== imgUrl);

      // Remove from Cloudinary
      const publicId = getCloudinaryPublicId(imgUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log('Deleted variant image:', publicId);
      }
    }
  }
}

    
        await variant.save();
        
      } catch (error) {
        console.error(`Error updating variant ${variantData._id}:`, error.message);
      }
    }

 
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