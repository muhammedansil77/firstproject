
import mongoose from 'mongoose';
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Variant from "../../models/Variant.js";
import { listProductsService,
  createProductService ,
  patchProductService 
 } from "../../services/productServices.js";
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
    const result = await listProductsService(req.query);

    return res.json({
      success: true,
      products: result.products,
      pagination: result.pagination
    });

  } catch (err) {
    console.error("listProducts error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error listing products"
    });
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
    await createProductService(req.body, req.files);

    return res.json({
      success: true,
      message: "Product created successfully"
    });

  } catch (err) {
    console.error("createProduct error:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Server error while creating product"
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
    const productId = req.params.id;

    const updatedProduct = await patchProductService(productId, req.body, req.files);

    return res.json({
      success: true,
      message: "Product & variants updated successfully",
      product: updatedProduct
    });

  } catch (err) {
    console.error("PATCH PRODUCT ERROR:", err);

    return res.status(400).json({
      success: false,
      message: err.message || "Server error updating product"
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