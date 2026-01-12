import Wallet from '../models/Wallet.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';




let razorpayInstance;
let isMockMode = false;

try {

  const hasKeyId = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.startsWith('rzp_');
  const hasKeySecret = !!process.env.RAZORPAY_KEY_SECRET;
  
  if (hasKeyId && hasKeySecret) {
  
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
   
  } else {

    throw new Error('Razorpay keys not configured, using mock mode');
  }
} catch (error) {
  console.warn('⚠️ ' + error.message);
  isMockMode = true;
  

  razorpayInstance = {
    orders: {
      create: async (options) => {
       
        return {
          id: 'mock_order_' + Date.now(),
          amount: options.amount,
          currency: options.currency || 'INR',
          receipt: options.receipt,
          status: 'created'
        };
      }
    }
  };

}


const razorpay = razorpayInstance;

export const checkRazorpay = (req, res) => {
  res.json({
    success: true,
    razorpay: {
      initialized: !!razorpay,
      mode: isMockMode ? 'mock' : 'real',
      keyConfigured: !!process.env.RAZORPAY_KEY_ID
    }
  });
};


// Get wallet page
export const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: []
      });
      await wallet.save();
    }
    
    const sortedTransactions = [...wallet.transactions].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    
 
    
    res.render('user/pages/wallet', {
         title: 'My wallet',
      pageJs: 'wallet.js',
      wallet: {
        balance: wallet.balance || 0,
        transactions: sortedTransactions
      },
      razorpayKeyId: razorpayKeyId,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Error loading wallet:', error);
    res.status(500).render('error', { 
      message: 'Failed to load wallet page' 
    });
  }
};




export const createPaymentOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    
   
    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum amount is ₹10'
      });
    }
    
 
    const receiptId = Date.now().toString(); 
 
    
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: receiptId, 
      payment_capture: 1
    });
    
  
    
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
    
  } catch (error) {
    console.error('Razorpay error:', error);
    
   
    if (error.error) {
      console.error('Error details:', {
        field: error.error.field,
        description: error.error.description,
        code: error.error.code
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.error?.description || 'Payment order creation failed'
    });
  }
};


export const processPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount
    } = req.body;
    
    const userId = req.session.userId;
    

    
  
    if (!isMockMode) {
     
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');
      
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed'
        });
      }
    }
    
   
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: []
      });
    }
    
  
    const paymentDetails = {
      razorpay_payment_id: razorpay_payment_id || `mock_pay_${Date.now()}`,
      razorpay_order_id,
      razorpay_signature: razorpay_signature || `mock_sig_${Date.now()}`,
      amount: parseFloat(amount)
    };
    

    await wallet.addMoney(parseFloat(amount), paymentDetails);
    
 
    
    res.json({
      success: true,
      message: `₹${amount} added to wallet successfully!`,
      newBalance: wallet.balance,
      isMockMode: isMockMode
    });
    
  } catch (error) {
    console.error('❌ Payment processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
};


export const getTransactions = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }
    
    const wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      return res.json({ 
        success: true, 
        transactions: [] 
      });
    }
    
    
    const transactions = [...wallet.transactions].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.json({ 
      success: true, 
      transactions: transactions.map(tx => ({
        id: tx._id,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        status: tx.status,
        payment_method: tx.payment_method,
        paymentId: tx.razorpay_payment_id ? tx.razorpay_payment_id.substring(0, 8) + '...' : null,
        createdAt: tx.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch transactions' 
    });
  }
};

export const testAuth = async (req, res) => {
  try {
  
    
    res.json({
      success: true,
      sessionExists: !!req.session,
      userId: req.session.userId,
      user: req.session.user,
      isLoggedIn: req.session.isLoggedIn
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};