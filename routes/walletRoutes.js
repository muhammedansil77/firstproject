// routes/walletRoutes.js (updated)
import express from 'express';
import { 
  getWalletPage, 
  createPaymentOrder, 
  processPayment,
  getTransactions,
  testAuth ,
  checkRazorpay 
} from '../controllers/wallerController.js';
// import { isAuthenticated } from '../middlewares/user/auth.js';

const router = express.Router();
router.get('/test-auth', testAuth);
router.get('/check-razorpay', checkRazorpay);

// Wallet page (requires auth)
router.get('/wallet', getWalletPage);

// API endpoints (require auth)
router.post('/api/wallet/create-order',  createPaymentOrder);
router.post('/api/wallet/process-payment', processPayment);
router.get('/api/wallet/transactions',  getTransactions);

export default router;