
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
    // ignore
  }
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const renderManageProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: false })
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

    const filter = { isDeleted: false };

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
          resolved = await Category.findOne({ name: { $regex: '^' + escapeRegex(category) + '$', $options: 'i' } }, { _id: 1 }).lean();
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

    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
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
        try {
          const savedPath = await processVariantImage(f); 
          if (savedPath) {
            const clean = String(savedPath).replace(/^\/+/, '').replace(/\\/g, '/');
            saved.push(clean);
            tempSavedFilesForCleanup.push(clean);
            console.log(`createProduct: processVariantImage saved for idx=${idx}:`, clean);
          } else {
            console.warn(`createProduct: processVariantImage returned falsy for idx=${idx}`);
          }
        } catch (e) {
          console.warn('createProduct: processVariantImage failed idx', idx, e && e.message);
        }
      }
      return saved;
    }

    
    let savedProductFilenames = [];
    if (productFiles.length > 0) {
      try {
        const saved = await processProductImages(productFiles); 
        savedProductFilenames = (saved || []).map(s => String(s).replace(/^\/+/, '').replace(/\\/g, '/')).filter(Boolean);
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



export async function patchProduct(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'Product id required' });

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

   
    const { name, description, category } = req.body;
    if (typeof name !== 'undefined' && name !== null) {
      if (String(name).trim() === '') return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      product.name = String(name).trim();
    }
    if (typeof description !== 'undefined') product.description = String(description);

    if (typeof category !== 'undefined') {
      if (!category) product.category = null;
      else if (mongoose.Types.ObjectId.isValid(category)) product.category = new mongoose.Types.ObjectId(category);
      else {
        try {
          const catDoc = await Category.findOne({ name: { $regex: '^' + escapeRegex(category) + '$', $options: 'i' } }, { _id: 1 }).lean();
          if (catDoc && catDoc._id) product.category = catDoc._id;
        } catch (e) { console.warn('patchProduct: category resolve error', e && e.message); }
      }
    }

    const files = Array.isArray(req.files) ? req.files : (req.files ? Object.values(req.files).flat() : []);

    const productFiles = (files || []).filter(f => ['productImages[]','productImages','images','images[]'].includes(f.fieldname));

  
    const variantFilesMap = {};
    for (const f of files) {
      const m = f.fieldname && f.fieldname.match(/^variants\[(\d+)\]\[image\](?:\[\])?$/);
      if (m) {
        const idx = m[1];
        variantFilesMap[idx] = variantFilesMap[idx] || [];
        variantFilesMap[idx].push(f);
      }
    }

   
    const variantsFromBody = {};
    Object.keys(req.body || {}).forEach(k => {
      const m = k.match(/^variants\[(\d+)\]\[(color|stock|price|salePrice|isListed)\]$/);
      if (m) {
        const idx = m[1];
        const key = m[2];
        variantsFromBody[idx] = variantsFromBody[idx] || {};
        variantsFromBody[idx][key] = req.body[k];
      }
    });

  
    const variantsAreRefs = product.variants && product.variants.length && mongoose.Types.ObjectId.isValid(String(product.variants[0]));

 
    let productSavedFilenames = [];
    if (productFiles.length > 0) {
      try {
       const saved = await processProductImages(productFiles);
productSavedFilenames = (saved || []).map(s => String(s).replace(/^\/+/, '').replace(/\\/g, '/')).filter(Boolean);
product.images = productSavedFilenames;

      } catch (e) {
        console.warn('patchProduct: processProductImages failed', e && e.message);
      }
    }

 
    let variantDocs = [];
    if (variantsAreRefs) {
      variantDocs = product.variants && product.variants.length ? await Variant.find({ _id: { $in: product.variants } }).sort({ _id: 1 }).exec() : [];
    } else {
      variantDocs = Array.isArray(product.variants) ? product.variants.map(v => Object.assign({}, v)) : [];
    }

   
    const existingCount = variantDocs.length;
    const fileIdxs = Object.keys(variantFilesMap).map(x => Number(x));
    const maxFileIdx = fileIdxs.length ? Math.max(...fileIdxs) : -1;
    const maxIdx = Math.max(existingCount - 1, maxFileIdx);


    for (let idx = 0; idx <= maxIdx; idx++) {
      const idxStr = String(idx);
      const bodyV = variantsFromBody[idxStr];
      const fileGroup = variantFilesMap[idxStr] || [];

      if (!variantsAreRefs && !variantDocs[idx]) variantDocs[idx] = { images: [], color: null, stock: 0, price: null, salePrice: null, isListed: false };

      if (bodyV) {
        if (variantsAreRefs) {
          const doc = variantDocs[idx];
          if (doc) {
            const updates = {};
            if (typeof bodyV.color !== 'undefined') updates.color = bodyV.color;
            if (typeof bodyV.stock !== 'undefined') updates.stock = Number(bodyV.stock) || 0;
            if (typeof bodyV.price !== 'undefined') updates.price = Number(bodyV.price) || null;
            if (typeof bodyV.salePrice !== 'undefined') updates.salePrice = (bodyV.salePrice ? Number(bodyV.salePrice) : null);
            if (typeof bodyV.isListed !== 'undefined') updates.isListed = (bodyV.isListed === 'true' || bodyV.isListed === '1' || bodyV.isListed === true);
            await Variant.findByIdAndUpdate(doc._id, updates).catch(()=>{});
          }
        } else {
          if (typeof bodyV.color !== 'undefined') variantDocs[idx].color = bodyV.color;
          if (typeof bodyV.stock !== 'undefined') variantDocs[idx].stock = Number(bodyV.stock) || 0;
          if (typeof bodyV.price !== 'undefined') variantDocs[idx].price = Number(bodyV.price) || null;
          if (typeof bodyV.salePrice !== 'undefined') variantDocs[idx].salePrice = (bodyV.salePrice ? Number(bodyV.salePrice) : null);
          if (typeof bodyV.isListed !== 'undefined') variantDocs[idx].isListed = (bodyV.isListed === 'true' || bodyV.isListed === '1' || bodyV.isListed === true);
        }
      }


      if (fileGroup.length) {
        const savedPaths = [];
        for (const f of fileGroup) {
          try {
           const savedPath = await processVariantImage(f);
if (savedPath) savedPaths.push(String(savedPath).replace(/^\/+/, '').replace(/\\/g, '/'));

          } catch (e) {
            console.warn('patchProduct: failed saving variant image idx', idx, e && e.message);
          }
        }
        if (savedPaths.length) {
          if (variantsAreRefs) {
            const doc = variantDocs[idx];
            if (doc) {
            
              if (Array.isArray(doc.images)) {
                doc.images.forEach(old => { try { const p = path.join(process.cwd(),'public',old); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e){} });
              }
              await Variant.findByIdAndUpdate(doc._id, { $set: { images: savedPaths } }).catch(()=>{});
            } else {
          
              const created = await Variant.create({
                product: product._id,
                images: savedPaths,
                stock: 0,
                color: null,
                price: null,
                isListed: false
              });
              product.variants = product.variants || [];
              product.variants.push(created._id);
              variantDocs[idx] = created;
            }
          } else {
           
            if (!variantDocs[idx]) variantDocs[idx] = { images: [], color: null, stock: 0, price: null };
          
            if (variantDocs[idx].images && variantDocs[idx].images.length) {
              variantDocs[idx].images.forEach(old => { try { const p = path.join(process.cwd(),'public',old); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e){} });
            }
            variantDocs[idx].images = savedPaths;
          }
        }
      }
    }

  
    if (productSavedFilenames && productSavedFilenames.length) {
      for (let i = 0; i < productSavedFilenames.length; i += 3) {
        const imgs = productSavedFilenames.slice(i, i+3);
        const idx = i / 3; 
        if (!imgs.length) continue;
        if (variantsAreRefs) {
          const doc = variantDocs[idx];
          if (doc) {
           
            if (doc.images && doc.images.length) doc.images.forEach(old => { try { const p = path.join(process.cwd(),'public',old); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e){} });
            await Variant.findByIdAndUpdate(doc._id, { $set: { images: imgs } }).catch(()=>{});
          } else {
            const created = await Variant.create({
              product: product._id,
              images: imgs,
              stock: 0,
              color: null,
              price: null,
              isListed: false
            });
            product.variants = product.variants || [];
            product.variants.push(created._id);
            variantDocs[idx] = created;
          }
        } else {
          if (!variantDocs[idx]) variantDocs[idx] = { images: imgs, color: null, stock: 0, price: null, isListed: false };
          else {
          
            if (variantDocs[idx].images && variantDocs[idx].images.length) variantDocs[idx].images.forEach(old => { try { const p = path.join(process.cwd(),'public',old); if (fs.existsSync(p)) fs.unlinkSync(p); } catch(e){} });
            variantDocs[idx].images = imgs;
          }
        }
      }
    }

 
    if (variantsAreRefs) {
      await product.save();
    } else {
      product.variants = variantDocs.filter(Boolean);
      await product.save();
    }

  
    const finalProduct = variantsAreRefs ? await Product.findById(product._id).populate('variants').lean() : (product.toObject ? product.toObject() : product);
    const finalVariants = finalProduct.variants || [];
    for (let i = 0; i < finalVariants.length; i++) {
      const v = finalVariants[i];
      const imgs = (v && v.images) ? (Array.isArray(v.images) ? v.images : [v.images]) : [];
      if (imgs.length < 3) {
        return res.status(400).json({ success: false, message: `Variant ${i} must have at least 3 images (currently ${imgs.length}).` });
      }
    }

 
    const out = variantsAreRefs ? await Product.findById(product._id).populate('variants').lean() : (product.toObject ? product.toObject() : product);
    return res.json({ success: true, product: out });
  } catch (err) {
    console.error('patchProduct error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating product', error: String(err) });
  }
}
