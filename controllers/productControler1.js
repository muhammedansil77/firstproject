
const path = require('path');
const mongoose = require('mongoose');


function loadModel(relPath) {
  try {
    const absPath = path.join(process.cwd(), relPath);
    const mod = require(absPath);
    return mod?.default || mod;
  } catch (err) {
    console.warn('Direct load failed for:', relPath, err && err.message);


    try {
      const modelName = path.basename(relPath).replace(/\.js$/, '');
      if (mongoose.modelNames().includes(modelName)) {
        console.log('Loaded from Mongoose registry:', modelName);
        return mongoose.model(modelName);
      }
    } catch (e2) {
      console.warn('Mongoose fallback failed for:', relPath, e2 && e2.message);
    }

    return null;
  }
}


const Product = loadModel('models/Product');
const Variant = loadModel('models/Variant');
const Review = loadModel('models/Review');

if (!Product) throw new Error('Product model not loaded!');


function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}


function normPath(p) {
  if (!p) return null;
  const s = String(p).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
 
  return '/' + s.replace(/^\/+/, '');
}

exports.viewProduct = async (req, res, next) => {
  try {
    const param = req.params.id;
    if (!param) return res.status(404).redirect('/user/shop');

    let product = null;
    let variantFromId = null;

   
    if (mongoose.Types.ObjectId.isValid(param)) {
      product = await Product.findById(param).lean().catch(()=>null);
    }


    if (!product) {
      product = await Product.findOne({ slug: param }).lean().catch(()=>null);
    }


    if (!product) {
      if (Variant && mongoose.Types.ObjectId.isValid(param)) {
        variantFromId = await Variant.findById(param).lean().catch(()=>null);
      }
      if (variantFromId && variantFromId.product) {
        product = await Product.findById(variantFromId.product).lean().catch(()=>null);
      }
    }

    if (!product) {
      console.log('viewProduct: not found for param:', param);
      return res.status(404).redirect('/user/shop');
    }

    const isUnavailable = !!(
      product.isDeleted ||
      product.isBlocked ||
      product.isListed === false
    );
    if (isUnavailable) {
      return res.redirect('/user/shop');
    }

  
    let variants = [];
    try {
      if (Array.isArray(product.variants) && product.variants.length) {
        variants = await Variant.find({ _id: { $in: product.variants } }).lean();
      } else if (Variant) {
        variants = await Variant.find({ product: product._id }).lean();
      }
    } catch (e) {
      console.warn('viewProduct: error loading variants', e && e.message);
      variants = [];
    }

 
    variants = (variants || []).map(v => {
      let imgs = [];
      if (Array.isArray(v.images) && v.images.length) imgs = v.images;
      else if (v.image) imgs = Array.isArray(v.image) ? v.image : [v.image];

      return {
        ...v,
        images: Array.isArray(imgs) ? imgs.map(normPath).filter(Boolean) : [],
        salePrice: toNum(v.salePrice),
        regularPrice: toNum(v.regularPrice || v.price),
        price: toNum(v.price),
        stock: toNum(v.stock) || 0,
        rating: toNum(v.rating) || 0,
        color: v.color || v.colour || v.colorName || 'Default',
        colour: v.color || v.colour || v.colorName || 'Default'
      };
    });

   
    let selectedVariant = null;
    const qVar = req.query.variant && mongoose.Types.ObjectId.isValid(req.query.variant)
      ? String(req.query.variant)
      : null;
    const variantIds = variants.map(v => String(v._id));

    if (qVar && variantIds.includes(qVar)) {
      selectedVariant = variants.find(v => String(v._id) === qVar);
    } else if (variantFromId && variantIds.includes(String(variantFromId._id))) {
      selectedVariant = variants.find(v => String(v._id) === String(variantFromId._id));
    } else if (variants.length > 0) {
      selectedVariant = variants[0];
    }


    const colorGroups = {};
    variants.forEach(v => {
      const c = (v.color || 'Default').toString();
      if (!colorGroups[c]) colorGroups[c] = [];
      colorGroups[c].push(v);
    });
    if (Object.keys(colorGroups).length === 0 && selectedVariant) {
      colorGroups[selectedVariant.color || 'Default'] = [selectedVariant];
    }


    let reviews = [];
    try {
      if (Review) {
        reviews = await Review.find({ product: product._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      }
    } catch (e) {
      console.warn('viewProduct: error loading reviews', e && e.message);
      reviews = [];
    }

let related = [];
try {
  if (product.category) {

    let categoryId = product.category;

    if (typeof categoryId === 'string' && !mongoose.Types.ObjectId.isValid(categoryId)) {
      const Category = loadModel('models/Category');
      if (Category) {
        const cat = await Category.findOne({
          name: { $regex: new RegExp('^' + categoryId + '$', 'i') },
          active: true,
          isDeleted: { $ne: true }
        }).select('_id').lean();
        
        if (cat) {
          categoryId = cat._id;
        } else {
          console.log('Category not found by name:', categoryId);
        }
      }
    }

    related = await Product.find({
      category: categoryId,
      _id: { $ne: product._id },
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      isListed: { $ne: false }
    })
    .select('name images price salePrice finalPrice minPrice category slug')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();


    related = related.map(p => {
 
      let images = [];
      if (Array.isArray(p.images) && p.images.length > 0) {
        images = p.images.map(img => normPath(img)).filter(Boolean);
      }
      
      if (images.length === 0) {
       
        images = ['/uploads/placeholder.png'];
      }
      
      // Calculate best price
      const priceCandidates = [
        p.finalPrice,
        p.salePrice, 
        p.minPrice,
        p.price
      ];
      
      let displayPrice = 0;
      for (const price of priceCandidates) {
        const numPrice = toNum(price);
        if (numPrice !== null && numPrice > 0) {
          displayPrice = numPrice;
          break;
        }
      }
      

      const hasImage = images.length > 0 && images[0] !== '/uploads/placeholder.png';
      
      return {
        ...p,
        _id: String(p._id), 
        images: images,
        image: images[0] || '/uploads/placeholder.png',
        displayPrice: displayPrice,
        hasImage: hasImage,
        slug: p.slug || String(p._id) 
      };
    });
    
    console.log('Related products found:', related.length);
    if (related.length > 0) {
      console.log('Sample related product:', {
        name: related[0].name,
        price: related[0].displayPrice,
        hasImage: related[0].hasImage,
        image: related[0].image
      });
    }
  }
} catch (err) {
  console.warn('Related products query failed:', err && err.message);
  related = [];
}

    
    if (!selectedVariant) selectedVariant = {};
    const productImagesNormalized = Array.isArray(product.images) ? product.images.map(normPath).filter(Boolean) : [];
    const effectiveImages = (selectedVariant && Array.isArray(selectedVariant.images) && selectedVariant.images.length)
      ? selectedVariant.images
      : productImagesNormalized;

    const viewProduct = {
      ...product,
      images: effectiveImages,
      highlights: Array.isArray(product.highlights) ? product.highlights : []
    };


    const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

 
    return res.render("user/pages/product", {
      product: viewProduct,
      selectedVariant,
      colorGroups,
      related,
      reviews: reviews || [],
      totalStock,
      productId: String(product._id),
      availabilityUrl: `/user/shop/${product._id}/availability`,
      pageTitle: product.name,
      pageJs: "product1.js"
    });

  } catch (err) {
    console.error("viewProduct error →", err && (err.stack || err.message || err));
    next(err);
  }
};


exports.checkAvailability = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, reason: "invalid_id" });
    }

    let product = await Product.findById(id).lean();
    let variants = [];

    if (!product) {
      const variant = await Variant.findById(id).lean();
      if (!variant) return res.status(404).json({ ok: false, reason: "not_found" });

      product = await Product.findById(variant.product).lean();
      if (!product) return res.status(404).json({ ok: false, reason: "not_found" });
    }

    if (product.isDeleted || product.isBlocked || product.isListed === false) {
      return res.status(410).json({ ok: false, reason: "unavailable" });
    }

    variants = await Variant.find({ product: product._id }).lean();

    const stock = variants
      .filter(v => Number(v.stock) > 0)
      .reduce((s, v) => s + Number(v.stock), 0);

    return res.json({ ok: true, stock });

  } catch (err) {
    console.error("checkAvailability error:", err && (err.stack || err.message || err));
    return res.status(500).json({ ok: false });
  }
};
