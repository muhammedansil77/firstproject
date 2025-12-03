const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const authMiddle = require("../middlewares/user/authMiddleware");
const categoryCtrl = require('../controllers/categoryController');
const productCtrl = require('../controllers/productControler1');
const path = require("path");
const passport = require('passport');
router.use(authMiddle.preventCacheForAuth);

// Apply attachUser to all routes to get user info in locals
router.use(authMiddle.attachUser);

// Apply preventBackToAuth to handle back button issues
router.use(authMiddle.preventBackToAuth);

// PROTECTED HOME (middleware order: protect -> noCache -> handler)
router.get(
  "/home",
  authMiddle.protectRoute,
  authMiddle.noCache,
  userController.loadHomePage
);

// PUBLIC / AUTH ROUTES (PRG pattern: POST handlers redirect)
router.get("/login", userController.loadLoginPage);
router.post("/login", userController.login);

router.get("/signup", userController.loadSignUp);
router.post("/signup", userController.signup);

// Signup verification (GET shows page, POST verifies OTP via JSON fetch)
router.get("/verify-otp", userController.loadVerifyOtpPage);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

// Logout
router.get("/logout", userController.logout);

// Forgot password flow (PRG)
router.get("/forgot-password", userController.loadForgotPassword);
router.post("/forgot-password", userController.forgotPassword);

// Page where user enters OTP for forgot-password (rendered after forgotPassword redirect)
router.get("/forget-verify-otp", userController.loadForgetVerifyOtpPage);

// Reset password (GET shows form, POST changes password and redirects)
router.get("/reset-password", userController.loadResetPassword);
router.post("/reset-password", userController.changePassword);

// Shop / product routes
router.get("/shop",authMiddle.protectRoute, categoryCtrl.loadShop);
// dev-only debug route — paste into routes file temporarily



// Debug: sample products


router.get('/shop/:id',authMiddle.protectRoute, productCtrl.viewProduct);
router.get('/shop/:id/availability',authMiddle.protectRoute, productCtrl.checkAvailability);


module.exports = router;
