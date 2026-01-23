import express from "express";
const router = express.Router();

import userController from "../controllers/userController.js";
import authMiddle from "../middlewares/user/authMiddleware.js";
import categoryCtrl from '../controllers/categoryController.js';
import productCtrl from '../controllers/productControler1.js';
import {
  addToCart,
  viewCart,
  updateCartQty,
  removeFromCart,
  removrAll,
  validateCheckout
} from "../controllers/cartController.js";



router.use(authMiddle.preventCacheForAuth);
router.use(authMiddle.attachUser);
router.use(authMiddle.preventBackToAuth);

router.get("/", authMiddle.noCache, userController.loadHomePage);
router.get("/login", userController.loadLoginPage);
router.post("/login", userController.login);
router.get("/signup", userController.loadSignUp);
router.post("/signup", userController.signup);
router.get("/verify-otp", userController.loadVerifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/logout", userController.logout);
router.get("/forgot-password", userController.loadForgotPassword);
router.post("/forgot-password", userController.forgotPassword);
router.get("/forget-verify-otp", userController.loadForgetVerifyOtpPage);
router.post("/verify-forgot-otp", userController.verifyForgotOtp);
router.post('/resend-forgot-otp', userController.resendForgotOtp);
router.get("/reset-password", userController.loadResetPassword);
router.post("/reset-password", userController.changePassword);
router.get("/shop", categoryCtrl.loadShop);
router.get('/shop/:id', productCtrl.viewProduct);
router.get('/shop/:id/availability',  productCtrl.checkAvailability);
router.get("/cart", authMiddle.protectRoute, viewCart);
router.post("/cart/add", authMiddle.protectRoute, addToCart);
router.post("/cart/update", authMiddle.protectRoute, updateCartQty);
router.post("/cart/remove", authMiddle.protectRoute, removeFromCart);
router.get('/validate',  validateCheckout);
router.post("/cart/clear",removrAll)

export default router;