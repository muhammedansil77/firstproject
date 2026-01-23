import Offer from '../../models/offer.js';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';

const offerController = {
 
  renderOffersPage: async (req, res) => {
    try {
      const { type, status, search, page = 1 } = req.query;
      const limit = 10;
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };

  
      if (type && ['product', 'category'].includes(type)) {
        query.type = type;
      }

      const now = new Date();
      if (status === 'active') {
        query.isActive = true;
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      } else if (status === 'upcoming') {
        query.isActive = true;
        query.startDate = { $gt: now };
      } else if (status === 'expired') {
        query.$or = [
          { isActive: false },
          { endDate: { $lt: now } }
        ];
      }

     
      let offersQuery = Offer.find(query)
        .populate('product', 'name images')
        .populate('category', 'name imagePath')
        .sort({ createdAt: -1 });

      if (search && search.trim() !== '') {
        const searchRegex = new RegExp(search.trim(), 'i');
        

        const offers = await offersQuery;
        
      
        const filteredOffers = offers.filter(offer => {
        
          if (offer.title && offer.title.match(searchRegex)) {
            return true;
          }
          
      
          if (offer.description && offer.description.match(searchRegex)) {
            return true;
          }
          
          
          if (offer.type === 'product' && offer.product && offer.product.name) {
            if (offer.product.name.match(searchRegex)) {
              return true;
            }
          }
          
        
          if (offer.type === 'category' && offer.category && offer.category.name) {
            if (offer.category.name.match(searchRegex)) {
              return true;
            }
          }
          
      
          const discountString = offer.discountValue.toString();
          if (discountString.includes(search)) {
            return true;
          }
          
      
          if (offer.discountType && offer.discountType.match(searchRegex)) {
            return true;
          }
          
          return false;
        });
        
    
        const totalOffers = filteredOffers.length;
        const paginatedOffers = filteredOffers.slice(skip, skip + limit);
        
    
        const offersWithStatus = paginatedOffers.map(offer => {
          let currentStatus = 'active';
          
          if (!offer.isActive) {
            currentStatus = 'inactive';
          } else if (offer.startDate > now) {
            currentStatus = 'upcoming';
          } else if (offer.endDate < now) {
            currentStatus = 'expired';
          }

          return {
            ...offer.toObject(),
            currentStatus
          };
        });

        const totalPages = Math.ceil(totalOffers / limit);

    
        const success_msg = req.flash('success')[0];
        const error_msg = req.flash('error')[0];

        return res.render('admin/offer', {
          title: 'Manage Offers',
          offers: offersWithStatus,
          currentPage: parseInt(page),
          totalPages,
          totalOffers,
          pageJS: 'offer.js',
          query: { type, status, search },
          user: req.user || null,
          success_msg: success_msg || null,
          error_msg: error_msg || null
        });
      }

    
      const offers = await offersQuery.skip(skip).limit(limit);
      
     
      const offersWithStatus = offers.map(offer => {
        let currentStatus = 'active';
        
        if (!offer.isActive) {
          currentStatus = 'inactive';
        } else if (offer.startDate > now) {
          currentStatus = 'upcoming';
        } else if (offer.endDate < now) {
          currentStatus = 'expired';
        }

        return {
          ...offer.toObject(),
          currentStatus
        };
      });

      const totalOffers = await Offer.countDocuments(query);
      const totalPages = Math.ceil(totalOffers / limit);

 
      const success_msg = req.flash('success')[0];
      const error_msg = req.flash('error')[0];

      res.render('admin/offer', {
        title: 'Manage Offers',
        offers: offersWithStatus,
        currentPage: parseInt(page),
        totalPages,
        totalOffers,
        pageJS: 'offer.js',
        query: { type, status, search },
        user: req.user || null,
        success_msg: success_msg || null,
        error_msg: error_msg || null
      });
    } catch (error) {
      console.error('Error rendering offers page:', error);
      res.render('admin/offer', {
        title: 'Manage Offers',
        error: 'Failed to load offers',
        offers: [],
        query: {},
        user: req.user || null,
        success_msg: null,
        error_msg: 'Failed to load offers'
      });
    }
  },

 
  getOfferJson: async (req, res) => {
    try {
      const offer = await Offer.findById(req.params.id)
        .populate('product', 'name images')
        .populate('category', 'name imagePath');

      if (!offer || offer.isDeleted) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
      }

      res.json({
        success: true,
        data: offer
      });
    } catch (error) {
      console.error('Error getting offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load offer'
      });
    }
  },


  getProductsAjax: async (req, res) => {
    try {
      const { search } = req.query;
      let productQuery = Product.find({ 
        isDeleted: false, 
        status: 'active' 
      }).select('name images');

      if (search && search.trim() !== '') {
        const searchRegex = new RegExp(search.trim(), 'i');
        productQuery = productQuery.find({ name: searchRegex });
      }

      const products = await productQuery
        .sort({ name: 1 })
        .limit(100);

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Error getting products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load products'
      });
    }
  },


  getCategoriesAjax: async (req, res) => {
    try {
      const { search } = req.query;
      let categoryQuery = Category.find({ 
        isDeleted: false, 
        active: true 
      }).select('name imagePath');

      if (search && search.trim() !== '') {
        const searchRegex = new RegExp(search.trim(), 'i');
        categoryQuery = categoryQuery.find({ name: searchRegex });
      }

      const categories = await categoryQuery
        .sort({ name: 1 })
        .limit(100);

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load categories'
      });
    }
  },

 
createOffer: async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers['content-type']);
 
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('Empty request body');
      
   
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'Request body is empty or invalid JSON'
        });
      } else {
        req.flash('error', 'All required fields must be filled');
        return res.redirect('/admin/offers');
      }
    }

    const {
      title,
      description,
      type,
      targetId,
      discountType,
      discountValue,
      maxDiscountAmount,
      startDate,
      endDate,
      priority,
      minPurchaseAmount
    } = req.body;

    console.log('Creating offer with data:', {
      title, type, targetId, discountType, discountValue
    });


    if (!title || !type || !targetId || !discountType || !discountValue || !startDate || !endDate) {
      console.error('Missing required fields');
      
   
      if (req.headers['x-requested-with'] === 'XMLHttpRequest' || 
          req.headers['content-type']?.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be filled'
        });
      } else {
        req.flash('error', 'All required fields must be filled');
        return res.redirect('/admin/offers');
      }
    }


const parsedDiscountValue = parseFloat(discountValue);
const parsedMinPurchase = parseFloat(minPurchaseAmount) || 0;
const parsedMaxDiscount = parseFloat(maxDiscountAmount) || 0;


if (parsedMinPurchase < 0) {
  return res.status(400).json({
    success: false,
    message: 'Minimum purchase amount cannot be negative'
  });
}


if (discountType === 'percentage') {
  if (parsedDiscountValue <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Percentage discount must be greater than 0'
    });
  }

  if (parsedDiscountValue > 100) {
    return res.status(400).json({
      success: false,
      message: 'Percentage discount cannot exceed 100%'
    });
  }

  if (parsedMaxDiscount < 0) {
    return res.status(400).json({
      success: false,
      message: 'Max discount amount cannot be negative'
    });
  }

  if (parsedMaxDiscount > 0 && parsedMinPurchase > 0 && parsedMaxDiscount > parsedMinPurchase) {
    return res.status(400).json({
      success: false,
      message: 'Max discount cannot exceed minimum purchase amount'
    });
  }
}


if (discountType === 'fixed') {
  if (parsedDiscountValue <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Fixed discount must be greater than 0'
    });
  }

  if (parsedMinPurchase > 0 && parsedDiscountValue > parsedMinPurchase) {
    return res.status(400).json({
      success: false,
      message: 'Fixed discount cannot exceed minimum purchase amount'
    });
  }
}

   
    if (type === 'product') {
      const product = await Product.findById(targetId);
      if (!product) {
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }
        req.flash('error', 'Product not found');
        return res.redirect('/admin/offers');
      }
    } else if (type === 'category') {
      const category = await Category.findById(targetId);
      if (!category) {
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
          return res.status(404).json({
            success: false,
            message: 'Category not found'
          });
        }
        req.flash('error', 'Category not found');
        return res.redirect('/admin/offers');
      }
    }


    const overlappingOffer = await Offer.findOne({
      type,
      targetId,
      isActive: true,
      isDeleted: false,
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
      ]
    });

    if (overlappingOffer) {
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this period'
        });
      }
      req.flash('error', 'An active offer already exists for this period');
      return res.redirect('/admin/offers');
    }

  
    const conditions = {};
    if (minPurchaseAmount && parseFloat(minPurchaseAmount) > 0) {
      conditions.minPurchaseAmount = parseFloat(minPurchaseAmount);
    }

    const offer = new Offer({
      title,
      description: description || '',
      type,
      targetId,
      discountType,
      discountValue: parseFloat(discountValue),
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priority: priority ? parseInt(priority) : 1,
      conditions,
      isActive: true
    });

    await offer.save();

  
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || 
        req.headers['content-type']?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Offer created successfully',
        data: offer
      });
    }

    req.flash('success', 'Offer created successfully');
    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Error creating offer:', error);
    
   
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || 
        req.headers['content-type']?.includes('application/json')) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create offer'
      });
    }
    
    req.flash('error', error.message || 'Failed to create offer');
    res.redirect('/admin/offers');
  }
},


  updateOffer: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        type,
        targetId,
        discountType,
        discountValue,
        maxDiscountAmount,
        startDate,
        endDate,
        priority,
        minPurchaseAmount
      } = req.body;

      console.log('Updating offer:', req.params.id, req.body);

      const offer = await Offer.findById(id);
      if (!offer) {
        req.flash('error', 'Offer not found');
        return res.redirect('/admin/offers');
      }

 
      const conditions = {};
      if (minPurchaseAmount && parseFloat(minPurchaseAmount) > 0) {
        conditions.minPurchaseAmount = parseFloat(minPurchaseAmount);
      }

      offer.title = title;
      offer.description = description;
      offer.type = type;
      offer.targetId = targetId;
      offer.discountType = discountType;
      offer.discountValue = parseFloat(discountValue);
      offer.maxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;
      offer.startDate = new Date(startDate);
      offer.endDate = new Date(endDate);
      offer.priority = priority ? parseInt(priority) : 1;
      offer.conditions = conditions;

      await offer.save();

      req.flash('success', 'Offer updated successfully');
      res.redirect('/admin/offers');
    } catch (error) {
      console.error('Error updating offer:', error);
      req.flash('error', error.message || 'Failed to update offer');
      res.redirect('/admin/offers');
    }
  },


  toggleOfferStatus: async (req, res) => {
    try {
      const offer = await Offer.findById(req.params.id);

      if (!offer) {
        req.flash('error', 'Offer not found');
        return res.redirect('/admin/offers');
      }

      offer.isActive = !offer.isActive;
      await offer.save();

      req.flash('success', `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`);
      res.redirect('/admin/offers');
    } catch (error) {
      console.error('Error toggling offer status:', error);
      req.flash('error', 'Failed to update offer status');
      res.redirect('/admin/offers');
    }
  },


  deleteOffer: async (req, res) => {
    try {
      const offer = await Offer.findById(req.params.id);

      if (!offer) {
        req.flash('error', 'Offer not found');
        return res.redirect('/admin/offers');
      }

      offer.isDeleted = true;
      offer.deletedAt = new Date();
      await offer.save();

      req.flash('success', 'Offer deleted successfully');
      res.redirect('/admin/offers');
    } catch (error) {
      console.error('Error deleting offer:', error);
      req.flash('error', 'Failed to delete offer');
      res.redirect('/admin/offers');
    }
  }
};

export default offerController;