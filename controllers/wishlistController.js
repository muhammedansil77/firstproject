
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';
import Cart from '../models/cart.js';
import { getBestOfferForProduct } from '../helpers/offerHelper.js';


import mongoose from 'mongoose';





export const getWishlistPage = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log('🔄 Loading wishlist for user:', userId);


    const wishlist = await Wishlist.findOne({ userId });

    console.log('📦 Found wishlist:', !!wishlist);
    console.log('📊 Wishlist items count:', wishlist?.items?.length || 0);

    let wishlistItems = [];

    if (wishlist && wishlist.items && wishlist.items.length > 0) {
      console.log('🔍 Processing wishlist items...');


      const processPromises = wishlist.items.map(async (item) => {
        try {
          console.log('📝 Processing item:', {
            itemId: item._id,
            productId: item.productId,
            variantId: item.variantId
          });


          const product = await Product.findOne({
            _id: item.productId,
            status: 'active',
            isDeleted: false
          })
            .populate('category', 'name _id')
            .select('name description category images status').lean();

          if (!product) {
            console.log('❌ Product not found or inactive:', item.productId);
            return null;
          }


          let variant = null;
          if (item.variantId) {
            variant = await Variant.findOne({
              _id: item.variantId,
              isListed: true
            }).select('color price salePrice stock images isListed').lean();

            if (!variant) {
              console.log(' Variant not found or not listed:', item.variantId);
              return null;
            }
          }


          const originalPrice = variant?.price || 0;
          const salePrice = variant?.salePrice || 0;
          const basePrice = salePrice > 0 && salePrice < originalPrice ? salePrice : originalPrice;

          let finalPrice = basePrice;
          let appliedOffer = null;
          let discountAmount = 0;
          let maxDiscountReached = false;


          if (basePrice > 0) {
            appliedOffer = await getBestOfferForProduct({
              _id: product._id,
              category: product.category?._id,
              price: basePrice
            });

            if (appliedOffer) {

              if (appliedOffer.discountType === 'percentage') {
                discountAmount = (basePrice * appliedOffer.discountValue) / 100;


                if (appliedOffer.maxDiscountAmount && discountAmount > appliedOffer.maxDiscountAmount) {
                  discountAmount = appliedOffer.maxDiscountAmount;
                  maxDiscountReached = true;
                }
              } else {
                discountAmount = Math.min(appliedOffer.discountValue, basePrice);
              }


              finalPrice = Math.max(basePrice - discountAmount, 0);
            }
          }

          console.log('✅ Item processed with offer:', {
            productName: product.name,
            basePrice: basePrice,
            finalPrice: finalPrice,
            hasOffer: !!appliedOffer,
            discountAmount: discountAmount
          });

          return {
            _id: item._id,
            productId: product,
            variantId: variant,
            addedOn: item.addedOn,
            pricing: {
              originalPrice: originalPrice,
              salePrice: salePrice,
              basePrice: basePrice,
              finalPrice: finalPrice,
              hasOffer: !!appliedOffer,
              offer: appliedOffer ? {
                title: appliedOffer.title,
                discountType: appliedOffer.discountType,
                discountValue: appliedOffer.discountValue,
                discountAmount: discountAmount,
                maxDiscountReached: maxDiscountReached,
                maxDiscountAmount: appliedOffer.maxDiscountAmount,
                priority: appliedOffer.priority
              } : null
            }
          };

        } catch (err) {
          console.error(' Error processing item:', err.message);
          return null;
        }
      });


      const results = await Promise.all(processPromises);
      wishlistItems = results.filter(item => item !== null);
    }

    console.log('Final wishlist items:', wishlistItems.length);


    const itemsWithOffers = wishlistItems.filter(item => item.pricing.hasOffer);
    console.log(` Items with offers: ${itemsWithOffers.length}/${wishlistItems.length}`);

    res.render('user/pages/wishlist', {
      title: 'My Wishlist',
      user: req.user,
      pageJs: 'wishlist.js',
      wishlistItems: wishlistItems,
      itemCount: wishlistItems.length,
      success: req.flash('success'),
      error: req.flash('error')
    });

  } catch (error) {
    console.error(' Error loading wishlist:', error);
    req.flash('error', 'Failed to load wishlist');
    res.redirect('/user/shop');
  }
};


export const addToWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.body;
    const userId = req.user?._id;

    console.log('Add to wishlist:', { productId, variantId, userId });


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to add to wishlist'
      });
    }


    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    let cleanVariantId = variantId;
    if (!cleanVariantId || cleanVariantId.trim() === '') {
      cleanVariantId = undefined;
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (cleanVariantId) {
      const variant = await Variant.findOne({
        _id: cleanVariantId,
        product: productId
      });

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found'
        });
      }
    }


    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        userId: userId,
        items: []
      });
    }


    const existingItem = wishlist.items.find(item => {
      const sameProduct = item.productId.toString() === productId;
      const sameVariant = (!item.variantId && !cleanVariantId) ||
        (item.variantId && item.variantId.toString() === cleanVariantId);
      return sameProduct && sameVariant;
    });


    if (existingItem) {
      return res.status(200).json({
        success: true,
        message: 'Already in wishlist',
        wishlist
      });
    }


    const wishlistItem = {
      productId: productId,
      addedOn: new Date()
    };


    if (cleanVariantId) {
      wishlistItem.variantId = cleanVariantId;
    }


    wishlist.items.push(wishlistItem);

    await wishlist.save();

    console.log('Wishlist updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Added to wishlist',
      wishlist
    });

  } catch (error) {
    console.error('Add to wishlist error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


export const removeFromWishlist = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?._id;

    console.log('Remove from wishlist:', { itemId, userId });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login'
      });
    }

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Wishlist item ID is required'
      });
    }

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }


    const itemToRemove = wishlist.items.find(item =>
      item._id.toString() === itemId
    );

    if (!itemToRemove) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist'
      });
    }

    console.log('Item to remove:', {
      itemId: itemToRemove._id,
      productId: itemToRemove.productId,
      variantId: itemToRemove.variantId
    });


    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(item =>
      item._id.toString() !== itemId
    );

    if (wishlist.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist'
      });
    }

    await wishlist.save();

    console.log('Item removed successfully. Remaining items:', wishlist.items.length);

    return res.status(200).json({
      success: true,
      message: 'Removed from wishlist',
      remainingCount: wishlist.items.length
    });

  } catch (error) {
    console.error('Remove error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};


export const moveToCart = async (req, res) => {
  try {
    const { itemId } = req.body;
    const userId = req.user._id;

    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Item ID missing' });
    }


    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    const wishlistItem = wishlist.items.find(
      item => item._id.toString() === itemId
    );

    if (!wishlistItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const variant = await Variant.findOne({
      _id: wishlistItem.variantId,
      isListed: true,
      stock: { $gt: 0 }
    });

    if (!variant) {
      return res.status(400).json({ success: false, message: 'Variant out of stock' });
    }


    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(
      item => item.variant.toString() === variant._id.toString()
    );

    if (existingItem) {
      return res.status(200).json({
        success: false,
        alreadyInCart: true,
        message: 'Product is already in your cart'
      });
    }


    cart.items.push({
      product: wishlistItem.productId,
      variant: variant._id,
      quantity: 1
    });



    wishlist.items = wishlist.items.filter(
      item => item._id.toString() !== itemId
    );

    await Promise.all([cart.save(), wishlist.save()]);

    return res.status(200).json({
      success: true,
      message: 'Added to cart',
      cartCount: cart.items.length,
      wishlistCount: wishlist.items.length
    });

  } catch (error) {
    console.error('Move to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
