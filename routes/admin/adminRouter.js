import express from "express";
import multer from "multer";

import * as adminController from "../../controllers/admin/adminController.js";

import * as categoryController from "../../controllers/admin/categoryController.js";

import * as productCtrl from "../../controllers/admin/productController.js";
import adminAuth from "../../middlewares/user/adminAuth.js";
import { upload } from "../../middlewares/upload.js";


const router = express.Router();


router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get('/logout', adminController.logout);


router.use(adminAuth);


router.get("/dashboard", adminController.loadDashboard);
router.get("/users", adminController.loadUsers);
router.post("/users/:id/block", adminController.blockUnblockUser);


router.get('/category', categoryController.loadCategoryPage);
router.get('/category/data', categoryController.getData);
router.post('/category', upload.single('image'), categoryController.createCategory);
router.put('/category/:id', upload.single('image'), categoryController.updateCategory);
router.post('/category/:id/block', categoryController.blockCategory);
router.post('/category/:id/unblock', categoryController.unblockCategory);


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


router.get("/product", productCtrl.renderManageProducts);
router.get("/product/data", productCtrl.listProducts);


router.get("/product/:id", productCtrl.getProduct);
router.get('/products/create', productCtrl.renderCreateProductPage);
router.get('/product/:id/edit', productCtrl.renderEditProductPage);


router.post("/product", uploadFields, productCtrl.createProduct);


router.patch("/product/:id", upload.any(), productCtrl.patchProduct);


router.delete('/product/:productId/image', productCtrl.deleteProductImage);
router.delete(
  '/product/variant/:id',
  
  productCtrl.deleteVariant
);


router.post('/product/:id/block', productCtrl.blockProduct);
router.post('/product/:id/unblock', productCtrl.unblockProduct);
router.post('/product/:id/toggle-status', productCtrl.toggleProductStatus);


const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


router.get('/category', asyncHandler(categoryController.loadCategoryPage));
router.get('/category/data', asyncHandler(categoryController.getData));


export default  router;