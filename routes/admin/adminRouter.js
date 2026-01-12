const express = require("express");
const multer = require("multer");
const adminController = require("../../controllers/admin/adminController");
const categoryController = require("../../controllers/admin/categoryController");
const productCtrl = require('../../controllers/admin/productController');
const adminAuth = require('../../middlewares/user/adminAuth');
const { upload } = require('../../middlewares/upload');

const router = express.Router();

// Public routes (no auth required)
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get('/logout', adminController.logout);

// All routes below require admin authentication
router.use(adminAuth);

// Dashboard & Users
router.get("/dashboard", adminController.loadDashboard);
router.get("/users", adminController.loadUsers);
router.post("/users/:id/block", adminController.blockUnblockUser);

// Categories
router.get('/category', categoryController.loadCategoryPage);
router.get('/category/data', categoryController.getData);
router.post('/category', upload.single('image'), categoryController.createCategory);
router.put('/category/:id', upload.single('image'), categoryController.updateCategory);
router.post('/category/:id/block', categoryController.blockCategory);
router.post('/category/:id/unblock', categoryController.unblockCategory);

// Products - File Upload Configuration
const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'images[]', maxCount: 10 },
  { name: 'productImages[]', maxCount: 10 },
  { name: 'variants[0][image][]', maxCount: 10 },
  { name: 'variants[1][image][]', maxCount: 10 },
  { name: 'variants[2][image][]', maxCount: 10 },
  { name: 'variants[3][image][]', maxCount: 10 },
  { name: 'variants[4][image][]', maxCount: 10 },
  { name: 'variantImage', maxCount: 20 }
]);

// Product Routes
router.get("/product", productCtrl.renderManageProducts); // View products page
router.get("/product/data", productCtrl.listProducts); // List products (for datatable)

// ✅ ADD THIS ROUTE - Get single product for editing
router.get("/product/:id", productCtrl.getProduct);

// Create product with file upload
router.post("/product", uploadFields, productCtrl.createProduct);

// Update product (allow any files)
router.patch("/product/:id", upload.any(), productCtrl.patchProduct);

// Delete product image
router.delete('/product/:productId/image', productCtrl.deleteProductImage);

// Product status management
router.post('/product/:id/block', productCtrl.blockProduct);
router.post('/product/:id/unblock', productCtrl.unblockProduct);
router.post('/product/:id/toggle-status', productCtrl.toggleProductStatus);

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply async handler to all routes
router.get('/category', asyncHandler(categoryController.loadCategoryPage));
router.get('/category/data', asyncHandler(categoryController.getData));
// Add asyncHandler to other routes as needed

module.exports = router;