import mongoose from 'mongoose';
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";

export const loadCategoryPage = async (req, res) => {
  try {
    res.render('admin/category', {
      title: 'Category Management',
      layout: 'admin/layouts/main',
      pageJS: 'category.js',
      cssFile: '/admin/css/category.css'
    });
  } catch (err) {
    console.error('loadCategoryPage error:', err);
    res.status(500).send('Server Error');
  }
};

export const getData = async (req, res) => {
  try {
    let { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all',
      sort = 'latest'  
    } = req.query;
    
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { isDeleted: { $ne: true } };

    
    if (search && String(search).trim()) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSearch, 'i');
      filter.$or = [
        { name: regex },
        { description: regex }
      ];
    }
  
   
    if (status === 'active') {
      filter.active = true;
    } else if (status === 'blocked') {
      filter.active = false;
    }
    
    console.log('[DEBUG] Filters:', filter);
    console.log('[DEBUG] Sort parameter:', sort);
    
    
    let sortOrder = {};
    switch(sort.toLowerCase()) {
      case 'a-z':
        sortOrder = { name: 1 }; 
        console.log('[DEBUG] Sorting by: name A-Z');
        break;
      case 'z-a':
        sortOrder = { name: -1 };
        console.log('[DEBUG] Sorting by: name Z-A');
        break;
      case 'latest':
        sortOrder = { createdAt: -1 }; 
        console.log('[DEBUG] Sorting by: latest first');
        break;
      case 'oldest':
        sortOrder = { createdAt: 1 };
        console.log('[DEBUG] Sorting by: oldest first');
        break;
      default:
        sortOrder = { createdAt: -1 }; 
        console.log('[DEBUG] Sorting by: default (latest)');
    }
    
    const totalItems = await Category.countDocuments(filter).catch(() => 0);
    
    let categories = await Category.find(filter)
      .sort(sortOrder) 
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []);
    
    if (!Array.isArray(categories)) categories = [];
    
   
    if (categories.length > 0) {
      console.log('[DEBUG] First 3 categories (for sorting verification):');
      categories.slice(0, 3).forEach((cat, index) => {
        console.log(`  ${index + 1}. ${cat.name} - Active: ${cat.active} - Created: ${cat.createdAt}`);
      });
    }
    
    return res.json({
      success: true,
      categories,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 0,
      currentPage: page,
      hasPrev: page > 1,
      hasNext: page < Math.ceil(totalItems / limit),
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < Math.ceil(totalItems / limit) ? page + 1 : null,
      filters: { search, status, sort } 
    });
  } catch (err) {
    console.error('getData error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to load categories' 
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    console.log('CREATE CATEGORY HIT! Body:', req.body, 'file:', req.file);

    const { name, description } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name too short' });
    }

    let imagePath;
    if (req.file) {
     
      imagePath = `/uploads/categories/${req.file.filename}`;
    }

    const newCat = new Category({
      name: name.trim(),
      description: description ? description.trim() : '',
      active: true,
      itemCount: 0,
      imagePath 
    });

    const saved = await newCat.save();
    console.log('SAVED TO MONGODB:', saved);
    res.status(201).json({
      success: true,
      message: 'Category created!',
      category: saved.toObject()
    });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !String(name).trim() || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    category.name = String(name).trim();
    category.description = description ? String(description).trim() : '';


    if (req.file) {
      category.imagePath = `/uploads/categories/${req.file.filename}`;
    }

    await category.save();
    res.json({ success: true, message: 'Category updated', category });
  } catch (err) {
    console.error('updateCategory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const blockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid category id required' });
    }

    const updated = await Category.findByIdAndUpdate(
      id, 
      { active: false }, 
      { new: true }
    ).lean();
    
    if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });

    console.log(`[category] blocked ${id}`);
    return res.json({ 
      success: true, 
      message: 'Category blocked successfully', 
      category: updated 
    });
    
  } catch (err) {
    console.error('blockCategory error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to block category', 
      error: err.message 
    });
  }
};

export const unblockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid category id required' });
    }

    const updated = await Category.findByIdAndUpdate(
      id, 
      { active: true }, 
      { new: true }
    ).lean();
    
    if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });

    console.log(`[category] unblocked ${id}`);
    return res.json({ 
      success: true, 
      message: 'Category unblocked successfully', 
      category: updated 
    });
    
  } catch (err) {
    console.error('unblockCategory error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to unblock category', 
      error: err.message 
    });
  }
};