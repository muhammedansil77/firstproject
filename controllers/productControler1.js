import path from 'path';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';
import Review from '../models/Review.js';
import { getBestOfferForProduct } from '../helpers/offerHelper.js';

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

const viewProduct = async (req, res, next) => {
  try {
    const param = req.params.id;
    if (!param) return res.status(404).redirect('/user/shop');

    let product = null;
    let variantFromId = null;

    // Find product by ID
    if (mongoose.Types.ObjectId.isValid(param)) {
      product = await Product.findById(param).lean().catch(() => null);
    }

    // Find product by slug
    if (!product) {
      product = await Product.findOne({ slug: param }).lean().catch(() => null);
    }

    // Find product by variant ID
    if (!product) {
      if (Variant && mongoose.Types.ObjectId.isValid(param)) {
        variantFromId = await Variant.findById(param).lean().catch(() => null);
      }
      if (variantFromId && variantFromId.product) {
        product = await Product.findById(variantFromId.product).lean().catch(() => null);
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

    // Load variants
    let rawVariants = [];
    try {
      if (Array.isArray(product.variants) && product.variants.length) {
        rawVariants = await Variant.find({ _id: { $in: product.variants } }).lean();
      } else if (Variant) {
        rawVariants = await Variant.find({ product: product._id }).lean();
      }
    } catch (e) {
      console.warn('viewProduct: error loading variants', e && e.message);
      rawVariants = [];
    }

    // Process variants with offers
    const variants = await Promise.all(rawVariants.map(async (v) => {
      let imgs = [];
      if (Array.isArray(v.images) && v.images.length) imgs = v.images;
      else if (v.image) imgs = Array.isArray(v.image) ? v.image : [v.image];

      // Calculate price for this variant
      const variantPriceCandidates = [
        toNum(v.salePrice),
        toNum(v.regularPrice || v.price),
        toNum(v.price)
      ];
      
      const variantBasePrice = variantPriceCandidates
        .find(val => Number.isFinite(val) && val > 0) || 0;

      // Get offer for this variant
      let variantOffer = null;
      let variantDiscountedPrice = variantBasePrice;
      let variantDiscountAmount = 0;
      let variantDiscountLabel = null;

      if (variantBasePrice > 0) {
        try {
          variantOffer = await getBestOfferForProduct({
            _id: product._id,
            category: product.category,
            price: variantBasePrice
          });

          if (variantOffer) {
            if (variantOffer.discountType === 'percentage') {
              variantDiscountAmount = (variantBasePrice * variantOffer.discountValue) / 100;
              variantDiscountLabel = `${variantOffer.discountValue}% OFF`;
            } else {
              variantDiscountAmount = variantOffer.discountValue;
              variantDiscountLabel = `₹${variantDiscountAmount.toLocaleString('en-IN')} OFF`;
            }

            if (variantOffer.maxDiscountAmount && variantDiscountAmount > variantOffer.maxDiscountAmount) {
              variantDiscountAmount = variantOffer.maxDiscountAmount;
            }

            variantDiscountedPrice = Math.max(variantBasePrice - variantDiscountAmount, 0);
          }
        } catch (offerErr) {
          console.warn('Error calculating offer for variant:', offerErr.message);
          // Continue without offer
        }
      }

      return {
        ...v,
        images: Array.isArray(imgs) ? imgs.map(normPath).filter(Boolean) : [],
        salePrice: toNum(v.salePrice),
        regularPrice: toNum(v.regularPrice || v.price),
        price: toNum(v.price),
        stock: toNum(v.stock) || 0,
        rating: toNum(v.rating) || 0,
        color: v.color || v.colour || v.colorName || 'Default',
        colour: v.color || v.colour || v.colorName || 'Default',
        colorCode: v.colorCode || v.hexColor || '#888888',
        
        // Add offer data
        offerData: {
          hasOffer: !!variantOffer,
          title: variantOffer?.title || '',
          discountType: variantOffer?.discountType || '',
          discountValue: variantOffer?.discountValue || 0,
          maxDiscountAmount: variantOffer?.maxDiscountAmount || null,
          discountedPrice: variantDiscountedPrice,
          discountAmount: variantDiscountAmount,
          discountLabel: variantDiscountLabel,
          basePrice: variantBasePrice
        }
      };
    }));

    // Organize variants by color
    const colorGroups = {};
    variants.forEach(v => {
      const c = (v.color || 'Default').toString();
      if (!colorGroups[c]) colorGroups[c] = [];
      colorGroups[c].push(v);
    });

    // Select variant
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

    if (!selectedVariant) selectedVariant = {};

    // Calculate main offer for selected variant
    const priceCandidates = [
      selectedVariant?.salePrice,
      selectedVariant?.regularPrice,
      selectedVariant?.price,
      product.minPrice,
      product.price
    ];

    const basePrice = priceCandidates
      .map(v => Number(v))
      .find(v => Number.isFinite(v) && v > 0) || null;

    let offer = null;
    let discountedPrice = basePrice;
    let discountAmount = 0;
    let discountLabel = null;

    if (basePrice) {
      offer = await getBestOfferForProduct({
        _id: product._id,
        category: product.category,
        price: basePrice
      });

      if (offer) {
        if (offer.discountType === 'percentage') {
          discountAmount = (basePrice * offer.discountValue) / 100;
          discountLabel = `${offer.discountValue}% OFF`;
        } else {
          discountAmount = offer.discountValue;
          discountLabel = `₹${discountAmount.toLocaleString('en-IN')} OFF`;
        }

        if (offer.maxDiscountAmount && discountAmount > offer.maxDiscountAmount) {
          discountAmount = offer.maxDiscountAmount;
        }

        discountedPrice = Math.max(basePrice - discountAmount, 0);
      }
    }

    // Load reviews
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

    // Load related products
    let related = [];
    try {
      if (product.category) {
        let categoryId = product.category;

        // Handle category name vs ID
        if (typeof categoryId === 'string' && !mongoose.Types.ObjectId.isValid(categoryId)) {
          try {
            const Category = (await import('../models/Category.js')).default;
            if (Category) {
              const cat = await Category.findOne({
                name: { $regex: new RegExp('^' + categoryId + '$', 'i') },
                active: true,
                isDeleted: { $ne: true }
              }).select('_id').lean();

              if (cat) {
                categoryId = cat._id;
              }
            }
          } catch (catErr) {
            console.log('Category lookup failed:', catErr.message);
          }
        }

        // Find related products
        related = await Product.find({
          category: categoryId,
          _id: { $ne: product._id },
          isDeleted: { $ne: true },
          isBlocked: { $ne: true },
          isListed: { $ne: false }
        })
          .select('name images category slug variants price salePrice finalPrice minPrice')
          .populate({
            path: 'variants',
            match: { isListed: true, stock: { $gt: 0 } },
            options: { sort: { price: 1 } }
          })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        // Process related products
        related = related.map(p => {
          let images = [];
          if (Array.isArray(p.images) && p.images.length > 0) {
            images = p.images.map(img => normPath(img)).filter(Boolean);
          }

          if ((!images || !images.length) && Array.isArray(p.variants) && p.variants.length) {
            const firstVariant = p.variants[0];
            if (Array.isArray(firstVariant.images) && firstVariant.images.length) {
              images = firstVariant.images.map(img => normPath(img)).filter(Boolean);
            }
          }

          if (!images.length) {
            images = ['/uploads/placeholder.png'];
          }

          let displayPrice = null;
          if (Array.isArray(p.variants) && p.variants.length) {
            const bestVariant =
              p.variants.find(v => v.isListed && toNum(v.salePrice) != null) ||
              p.variants.find(v => v.isListed && toNum(v.price) != null) ||
              p.variants[0];

            if (bestVariant) {
              displayPrice =
                toNum(bestVariant.salePrice) ||
                toNum(bestVariant.price) ||
                null;
            }
          }

          if (displayPrice == null) {
            const priceCandidates = [p.finalPrice, p.salePrice, p.minPrice, p.price];
            for (const price of priceCandidates) {
              const numPrice = toNum(price);
              if (numPrice !== null && numPrice > 0) {
                displayPrice = numPrice;
                break;
              }
            }
          }

          return {
            ...p,
            _id: String(p._id),
            images,
            image: images[0] || '/uploads/placeholder.png',
            displayPrice,
            hasImage: images.length > 0 && images[0] !== '/uploads/placeholder.png',
            slug: p.slug || String(p._id)
          };
        });
      }
    } catch (err) {
      console.warn('Related products query failed:', err && err.message);
      related = [];
    }

    // Prepare product images
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

    // Render the page
    return res.render("user/pages/product", {
      product: viewProduct,
      selectedVariant,
      colorGroups,
      variants, // Pass all variants for dynamic updates
      related,
      reviews: reviews || [],
      totalStock,

      // Offer data
      offer,
      discountedPrice,
      discountAmount,
      discountLabel,
      basePrice,

      // Additional data
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

const checkAvailability = async (req, res) => {
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

// Export the controller functions
export default {
  checkAvailability,
  viewProduct
};