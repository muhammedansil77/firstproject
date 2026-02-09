
import express from "express";
const router = express.Router();

import {retryRazorpayPayment} from "../controllers/orderController.js"

import {
  loadCheckout,
  getAddress,      
  createAddress,
  updateAddress,
  deleteAddress,
  placeOrder,
  loadOrderSuccess,
  loadOrderDetails,
  loadMyOrders,
  cancelUserOrder,
   loadRefundRequest,
   submitRefundRequest,
   getUserRefunds,
   checkRefundStatus,  
  getRefundDetails,
  verifyRazorpayPayment  ,
  createRazorpayOrder,
  applyCoupon,
  removeCoupon,
  loadUserInvoice ,
  markPaymentFailed



} from "../controllers/checkoutController.js";
import authMiddle from "../middlewares/user/authMiddleware.js";
import Product from "../models/Product.js"; 
import User from "../models/userSchema.js"; 


router.use(authMiddle.preventCacheForAuth);
router.use(authMiddle.attachUser);
router.use(authMiddle.preventBackToAuth);
router.use(authMiddle.protectRoute);


router.get("/checkout", loadCheckout);
router.get("/orders",  loadMyOrders);
router.post('/create-razorpay-order', createRazorpayOrder);
router.post('/verify-razorpay-payment', verifyRazorpayPayment);


router.get("/api/address/:id", getAddress);     
router.post("/api/address", createAddress);
router.patch("/api/address/:id", updateAddress);
router.delete("/api/address/:id", deleteAddress);
router.post('/checkout/apply-coupon', applyCoupon);
router.post('/checkout/remove-coupon',removeCoupon);


router.post("/place-order", placeOrder);


router.get("/order-success/:orderId", loadOrderSuccess);
router.get("/orders/:orderId", loadOrderDetails);
router.post("/orders/payment-failed", markPaymentFailed);
router.post("/orders/:orderId/cancel", cancelUserOrder);
router.post('/orders/retry-payment', retryRazorpayPayment);

router.get("/orders/:orderId/refund", loadRefundRequest);
router.post("/api/refunds/request", submitRefundRequest);
router.get("/refunds", getUserRefunds);
router.get('/orders/:id/invoice', loadUserInvoice );


router.get("/api/refund-status/:id", checkRefundStatus);    
router.get("/api/refunds/:id", getRefundDetails); 
export default router;