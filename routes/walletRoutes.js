
import express from 'express';
import { 
  getWalletPage, 
  createPaymentOrder, 
  processPayment,
  getTransactions,
  testAuth ,
  checkRazorpay 
} from '../controllers/wallerController.js';


const router = express.Router();
router.get('/test-auth', testAuth);
router.get('/check-razorpay', checkRazorpay);


router.get('/wallet', getWalletPage);


router.post('/api/wallet/create-order',  createPaymentOrder);
router.post('/api/wallet/process-payment', processPayment);
router.get('/api/wallet/transactions',  getTransactions);

export default router;