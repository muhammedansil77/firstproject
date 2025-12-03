// routes/admin.js  (fixed)
const express = require("express");
const multer = require("multer");

// NOTE: match your actual folder name. If your controllers live in "controller/admin/..." (singular),
// change the require paths accordingly.
const adminController = require("../../controllers/admin/adminController");
const categoryController = require("../../controllers/admin/categoryController");
const productCtrl = require('../../controllers/admin/productController');
const adminAuth = require('../../middlewares/user/adminAuth');

// your existing upload middleware (e.g. to validate auth or single image handling)
const { upload } = require('../../middlewares/upload');
const { route } = require("../userRouter");

const router = express.Router();

// Admin pages
router.get("/login",adminController.loadLogin)
router.post("/login", adminController.login);
router.get('/logout', adminController.logout);
router.use(adminAuth);
router.get("/dashboard", adminController.loadDashboard);
router.get("/users", adminController.loadUsers);
router.post("/users/:id/block", adminController.blockUnblockUser);

// Category routes (render + data)
router.get('/category', categoryController.loadCategoryPage);
router.get('/category/data', categoryController.getData);
router.post('/category', upload.single('image'), categoryController.createCategory);
router.put('/category/:id', upload.single('image'), categoryController.updateCategory);
// router.delete('/category/:id', categoryController.deleteCategory);
// router.post('/category/:id/restore', categoryController.restoreCategory);
router.post('/category/:id/block', categoryController.blockCategory);
router.post('/category/:id/unblock', categoryController.unblockCategory);

// Debug: show registered admin routes
console.log("Registered Admin Routes:", router.stack
  .filter(layer => layer.route)
  .map(layer => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods)
  }))
);

// === Multer memory storage instance for product images ===
// keep this separate from your uploadMiddleware
const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'variantImage', maxCount: 20 }
]);
router.get("/product",productCtrl.renderManageProducts)
router.get("/product/data", productCtrl.listProducts);

router.post(
  "/product",
  upload.any(),
  productCtrl.createProduct
);
router.patch("/product/:id",upload.any(),productCtrl.patchProduct)




module.exports = router;
