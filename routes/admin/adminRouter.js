import express from "express";
import multer from "multer";

import * as adminController from "../../controllers/admin/adminController.js";

import * as categoryController from "../../controllers/admin/categoryController.js";

import * as productCtrl from "../../controllers/admin/productController.js";
import adminAuth from "../../middlewares/user/adminAuth.js";
import { upload } from "../../middlewares/upload.js";


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
router.get('/products/create', productCtrl.renderCreateProductPage);
router.get('/product/:id/edit', productCtrl.renderEditProductPage);

// Create product with file upload
router.post("/product", uploadFields, productCtrl.createProduct);

// Update product (allow any files)
router.patch("/product/:id", upload.any(), productCtrl.patchProduct);

// Delete product image
router.delete('/product/:productId/image', productCtrl.deleteProductImage);
router.delete(
  '/product/variant/:id',
  
  productCtrl.deleteVariant
);

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

export default  router;