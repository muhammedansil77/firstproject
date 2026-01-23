import path from 'path';
import mongoose from 'mongoose';


import productModel from '../models/Product.js';
import categoryModel from '../models/Category.js';
import { getBestOfferForProduct } from '../helpers/offerHelper.js';


function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const loadShop = async (req, res, next) => {
  try {
    if (!productModel) {
      return next(new Error('Product model not loaded'));
    }

    const search = (req.query.search || '').trim();
    const sort = req.query.sort || '';
    const category = (req.query.category || '').trim();
    const minPrice =
      req.query.min !== undefined && req.query.min !== ''
        ? Number(req.query.min)
        : null;
    const maxPrice =
      req.query.max !== undefined && req.query.max !== ''
        ? Number(req.query.max)
        : null;

    const currentPage = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '12', 10));
    const skip = (currentPage - 1) * limit;


    const match = {
      isDeleted: { $ne: true },
      status: 'active'
    };

    if (search) {
      match.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { description: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        match.category = new mongoose.Types.ObjectId(category);
      } else if (categoryModel) {
        const catDoc = await categoryModel.findOne(
          {
            name: { $regex: '^' + escapeRegex(category) + '$', $options: 'i' },
            active: true,
            isDeleted: { $ne: true }
          },
          { _id: 1 }
        ).lean();

        if (catDoc) {
          match.category = catDoc._id;
        } else {
          match.category = category;
        }
      }
    }

    const pipeline = [

      { $match: match },
      {
  $lookup: {
    from: 'categories',
    localField: 'category',
    foreignField: '_id',
    as: 'categoryData'
  }
},
{
  $unwind: {
    path: '$categoryData',
    preserveNullAndEmptyArrays: false
  }
},
{
  $match: {
    'categoryData.active': true,
    'categoryData.isDeleted': { $ne: true }
  }
},


      {
        $lookup: {
          from: 'variants',
          let: { varIds: '$variants', prodId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [{ $isArray: ['$$varIds'] }, { $in: ['$_id', '$$varIds'] }] },
                    { $eq: ['$product', '$$prodId'] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                salePrice: 1,
                price: 1,
                stock: 1,
                color: 1,
                colour: 1,
                colorName: 1,
                images: 1,
                image: 1,
                isListed: 1
              }
            }
          ],
          as: 'variantsFull'
        }
      },
      {
  $addFields: {
    totalStock: {
      $sum: {
        $map: {
          input: '$variantsFull',
          as: 'v',
          in: {
            $cond: [
              {
                $and: [
                  { $ne: ['$$v.isListed', false] },
                  { $gt: ['$$v.stock', 0] }
                ]
              },
              '$$v.stock',
              0
            ]
          }
        }
      }
    }
  }
},



      {
        $addFields: {
          _listedVariants: {
            $filter: {
              input: '$variantsFull',
              as: 'v',
              cond: { $ne: ['$$v.isListed', false] }
            }
          }
        }
      },


      {
        $addFields: {
          _useVariantsForPrice: {
            $cond: [
              { $gt: [{ $size: '$_listedVariants' }, 0] },
              '$_listedVariants',
              '$variantsFull'
            ]
          }
        }
      },


      {
        $addFields: {
          _priceCandidates: {
            $map: {
              input: '$_useVariantsForPrice',
              as: 'vv',
              in: {
                $cond: [
                  { $ifNull: ['$$vv.salePrice', false] },
                  { $toDouble: '$$vv.salePrice' },
                  {
                    $cond: [
                      { $ifNull: ['$$vv.price', false] },
                      { $toDouble: '$$vv.price' },
                      null
                    ]
                  }
                ]
              }
            }
          }
        }
      },

      {
        $addFields: {
          minPrice: {
            $let: {
              vars: {
                tmpArr: {
                  $filter: {
                    input: '$_priceCandidates',
                    as: 'p',
                    cond: { $ne: ['$$p', null] }
                  }
                }
              },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$tmpArr' }, 0] },
                  { $min: '$$tmpArr' },
                  null
                ]
              }
            }
          },

          variantsCount: { $size: '$variantsFull' },

          availableColors: {
            $filter: {
              input: {
                $setUnion: [
                  {
                    $map: {
                      input: '$variantsFull',
                      as: 'vv',
                      in: {
                        $ifNull: [
                          '$$vv.color',
                          { $ifNull: ['$$vv.colour', { $ifNull: ['$$vv.colorName', null] }] }
                        ]
                      }
                    }
                  },
                  []
                ]
              },
              as: 'c',
              cond: { $ne: ['$$c', null] }
            }
          },

          sampleVariantId: {
            $cond: [
              { $gt: [{ $size: '$_listedVariants' }, 0] },
              { $arrayElemAt: ['$_listedVariants._id', 0] },
              { $arrayElemAt: ['$variantsFull._id', 0] }
            ]
          }
        }
      },

      {
        $project: {
          name: 1,
          description: 1,
          images: 1,
          minPrice: 1,
            totalStock: 1, 
          variantsCount: 1,
          availableColors: 1,
          sampleVariantId: 1,
          category: 1,
          createdAt: 1,
          updatedAt: 1,
          variantsFull: 1,
          status: 1
        }
      }
    ];

    if (minPrice !== null || maxPrice !== null) {
      const pm = {};
      if (minPrice !== null) pm.$gte = minPrice;
      if (maxPrice !== null) pm.$lte = maxPrice;
      pipeline.push({ $match: { minPrice: pm } });
    }

    const sortStage = {};
    if (sort === 'latest') {
      sortStage.createdAt = -1;
    } else if (sort === 'price-asc') {
      sortStage.minPrice = 1;
    } else if (sort === 'price-desc') {
      sortStage.minPrice = -1;
    } else if (sort === 'a-z') {
      sortStage.name = 1;
    } else if (sort === 'z-a') {
      sortStage.name = -1;
    } else {
      sortStage.createdAt = -1;
    }
    pipeline.push({ $sort: sortStage });

    pipeline.push({
      $facet: {
        results: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }]
      }
    });

    const aggOut = await productModel.aggregate(pipeline).exec();
    const results = aggOut?.[0]?.results || [];
    const totalCount = aggOut?.[0]?.totalCount?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));


    const blockedInResults = results.filter(p => p.status !== 'active');
    if (blockedInResults.length > 0) {
      console.warn('WARNING: Found blocked products in shop results:',
        blockedInResults.map(p => ({ id: p._id, name: p.name, status: p.status }))
      );
    }

    const products = results
      .filter(p => p.status === 'active')
      .map((p, idx) => {
        function norm(item) {
          if (!item) return null;
          const s = String(item).trim();
          if (!s) return null;
          if (/^https?:\/\//i.test(s)) return s;
          return '/' + s.replace(/^\/+/, '');
        }

        let imgs = Array.isArray(p.images) ? p.images.filter(Boolean).map(norm) : [];

        if (imgs.length === 0 && Array.isArray(p.variantsFull) && p.variantsFull.length) {
          const listed = p.variantsFull.find(v => v.isListed !== false) || p.variantsFull[0];

          if (listed) {
            if (Array.isArray(listed.images) && listed.images.length) {
              imgs = listed.images.filter(Boolean).map(norm);
            } else if (listed.image) {
              if (Array.isArray(listed.image)) {
                imgs = listed.image.filter(Boolean).map(norm);
              } else {
                imgs = [norm(listed.image)];
              }
            } else {
              for (const v of p.variantsFull) {
                if (Array.isArray(v.images) && v.images.length) {
                  imgs = v.images.filter(Boolean).map(norm);
                  break;
                } else if (v.image) {
                  imgs = [norm(v.image)];
                  break;
                }
              }
            }
          }
        }

        imgs = imgs.slice(0, 3);
        while (imgs.length < 3) imgs.push(null);



        return {
          _id: p._id,
          name: p.name,
          description: p.description,
          images: imgs,
          price: p.minPrice ?? null,
          minPrice: p.minPrice ?? null,
            totalStock: p.totalStock ?? 0,
          variantsCount: p.variantsCount || 0,
          availableColors: Array.isArray(p.availableColors) ? p.availableColors : [],
          sampleVariantId: p.sampleVariantId || null,
          category: mongoose.Types.ObjectId.isValid(p.category)
            ? new mongoose.Types.ObjectId(p.category)
            : null

        };
      });
      
    for (const product of products) {
      const basePrice = product.minPrice || product.price;

      if (!basePrice) {
        product.offer = null;
        continue;
      }

      const offer = await getBestOfferForProduct({
        _id: product._id,
        category: product.category,
        price: basePrice
      });

      if (!offer) {
        product.offer = null;
        continue;
      }

      let discountAmount = 0;

      if (offer.discountType === 'percentage') {
        discountAmount = (basePrice * offer.discountValue) / 100;
      } else {
        discountAmount = offer.discountValue;
      }

      if (offer.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, offer.maxDiscountAmount);
      }

      product.offer = {
        title: offer.title,
        type: offer.type,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        discountAmount,
        finalPrice: Math.max(basePrice - discountAmount, 0)
      };
    }


    let categories = [];
    try {
      if (categoryModel) {
        categories = await categoryModel.find({
          active: true,
          isDeleted: { $ne: true }
        }).sort({ name: 1 }).lean();
      }
    } catch (e) {
      console.warn('Could not load categories:', e && e.message);
      categories = [];
    }

    return res.render('user/pages/shop', {
      layout: 'user/layouts/main',
      pageTitle: 'Shop',
      query: req.query,
      products,
      brands: [],
      categories,
      breadcrumbs: [
        { name: 'Home', link: '/home' },
        { name: 'Shop', link: '/shop' }
      ],
      pagination: {
        currentPage,
        totalPages,
        hasPrevPage: currentPage > 1,
        hasNextPage: currentPage < totalPages
      },
      pageJs: 'shop-filters.js',
      pageCss: 'shop.css'
    });

  } catch (err) {
    console.error('loadShop error:', err);
    return next(err);
  }
};
export default {

  loadShop
}