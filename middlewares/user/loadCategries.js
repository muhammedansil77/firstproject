
import Category from "../../models/Category.js";


async function loadCategories(req, res, next) {
  try {
   
 
    const categories = await Category.find({ active: true, isDeleted: false })
                                     .sort({ name: 1 })
                                     .select('name imagePath itemCount') 
                                     .lean();

   
    res.locals.categories = categories || [];
    res.locals.currentPath = req.path || '';

  } catch (err) {
    console.error('loadCategories error:', err);
    res.locals.categories = [];
    res.locals.currentPath = req.path || '';
  }
  next();
}

export default loadCategories;
