
const mongoose = require('mongoose');
const Category = require('../../models/Category');
const path = require('path');
const fs = require('fs');


exports.loadCategoryPage = async (req, res) => {
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


exports.getData = async (req, res) => {
  try {
    let { page = 1, limit = 50, search = '', deleted, debug } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 50;
    const skip = (page - 1) * limit;
    const showDeleted = String(deleted) === 'true';

    const filter = showDeleted ? {} : { isDeleted: { $ne: true } };
    if (search && String(search).trim()) {
      filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    console.log('getData filter:', JSON.stringify(filter), 'page:', page, 'limit:', limit);

    const totalItems = await Category.countDocuments(filter).catch(() => 0);

    let categories = await Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .catch(() => []);

    if (!Array.isArray(categories)) categories = [];

    if (String(debug) === 'true') {
      return res.json({
        success: true,
        debug: { filter, totalItems, returnedCount: categories.length },
        categories,
        totalPages: Math.ceil(totalItems / limit) || 0,
        currentPage: page
      });
    }

    return res.json({
      success: true,
      categories,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 0,
      currentPage: page
    });
  } catch (err) {
    console.error('getData error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
};


exports.createCategory = async (req, res) => {
  try {
    console.log('CREATE CATEGORY HIT! Body:', req.body);
    const { name, description } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name too short' });
    }

    const newCat = new Category({
      name: name.trim(),
      description: description ? description.trim() : '',
      active: true,
      itemCount: 0
    });

    const saved = await newCat.save();
    console.log('SAVED TO MONGODB:', saved);
    res.status(201).json({ success: true, message: 'Category created!', category: saved.toObject() });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !String(name).trim() || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

  
    if (req.file) {
      const newImagePath = `/uploads/categories/${req.file.filename}`;

      if (category.imagePath && typeof category.imagePath === 'string') {
        try {
          if (category.imagePath.startsWith('/uploads/')) {
            const rel = category.imagePath.replace(/^\//, '');
            const oldAbsolute = path.join(__dirname, '..', '..', 'public', rel);
            if (fs.existsSync(oldAbsolute)) fs.unlinkSync(oldAbsolute);
          }
        } catch (err) {
          console.warn('Failed to delete old category image:', err);
        }
      }
      category.imagePath = newImagePath;
    }

    category.name = String(name).trim();
    category.description = description ? String(description).trim() : '';

    await category.save();
    res.json({ success: true, message: 'Category updated', category });
  } catch (err) {
    console.error('updateCategory error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.blockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid category id required' });
    }

    const updated = await Category.findByIdAndUpdate(id, { active: false }, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });

    console.log(`[category] blocked ${id}`);
    return res.json({ success: true, message: 'Category blocked', category: updated });
  } catch (err) {
    console.error('blockCategory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to block category', error: err.message });
  }
};

exports.unblockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid category id required' });
    }

    const updated = await Category.findByIdAndUpdate(id, { active: true }, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });

    console.log(`[category] unblocked ${id}`);
    return res.json({ success: true, message: 'Category unblocked', category: updated });
  } catch (err) {
    console.error('unblockCategory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to unblock category', error: err.message });
  }
};
