import path from 'path';
import mongoose from 'mongoose';


import productModel from '../models/Product.js';
import categoryModel from '../models/Category.js';
import { getBestOfferForProduct } from '../helpers/offerHelper.js';
import { loadShopService } from "../services/user/shopService.js";


function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

 const loadShop = async (req, res, next) => {
  try {

    const result = await loadShopService({
      productModel: Product,
      categoryModel: Category,
      query: req.query
    });

    return res.render("user/pages/shop", {
      layout: "user/layouts/main",
      pageTitle: "Shop",
      query: req.query,
      cartCount: res.locals.cartCount,
      products: result.products,
      categories: result.categories,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages
      },
      pageJs: "shop-filters.js",
      pageCss: "shop.css"
    });

  } catch (err) {
    console.error("loadShop error:", err);
    next(err);
  }
};
export default {

  loadShop
}