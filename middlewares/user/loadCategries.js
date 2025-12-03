// middlewares/loadCategories.js
const Category = require('../../models/Category');

async function loadCategories(req, res, next) {
  try {
    // Fetch only active, not-deleted categories
    // adjust limit or sort as needed (e.g., by itemCount, createdAt, position)
    const categories = await Category.find({ active: true, isDeleted: false })
                                     .sort({ name: 1 })
                                     .select('name imagePath itemCount') // pull only what's needed
                                     .lean();

    // expose categories and the current path for active-link logic
    res.locals.categories = categories || [];
    res.locals.currentPath = req.path || '';

  } catch (err) {
    console.error('loadCategories error:', err);
    res.locals.categories = [];
    res.locals.currentPath = req.path || '';
  }
  next();
}

module.exports = loadCategories;
