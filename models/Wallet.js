import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  razorpay_payment_id: String,
  razorpay_order_id: String,
  razorpay_signature: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending"
  },
  payment_method: {
    type: String,
    default: "razorpay"
  },
    referral_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral'
  },
  referred_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Existing fields
  refund_reason: String,
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  transactions: [transactionSchema]
}, {
  timestamps: true
});

// Method to add money to wallet
walletSchema.methods.addMoney = async function(amount, paymentDetails) {
  const transaction = {
    amount: amount,
    type: "credit",
    description: `Wallet recharge via Razorpay`,
    status: "success",
    payment_method: "razorpay",
    ...paymentDetails,
    createdAt: new Date()
  };
  
  this.transactions.push(transaction);
  this.balance += amount;
  
  await this.save();
  return transaction;
};
// Add this method to your wallet schema methods
walletSchema.methods.withdrawMoney = async function(amount, withdrawalRequestId, paymentDetails) {
    if (amount > this.balance) {
        throw new Error('Insufficient balance');
    }
    
    if (amount < 100) {
        throw new Error('Minimum withdrawal amount is ₹100');
    }
    
    const transaction = {
        amount: amount,
        type: "debit",
        description: `Withdrawal to ${payment_details.method}`,
        status: "pending",
        payment_method: "withdrawal",
        withdrawal_request_id: withdrawalRequestId,
        ...paymentDetails,
        createdAt: new Date()
    };
    
    this.transactions.push(transaction);
    this.balance -= amount;
    
    await this.save();
    return transaction;
};

walletSchema.methods.completeWithdrawal = async function(transactionId, transactionIdExternal) {
    const transaction = this.transactions.id(transactionId);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    
    transaction.status = "success";
    transaction.transaction_id = transactionIdExternal;
    
    await this.save();
    return transaction;
};

walletSchema.methods.failWithdrawal = async function(transactionId, reason) {
    const transaction = this.transactions.id(transactionId);
    if (!transaction) {
        throw new Error('Transaction not found');
    }
    
    transaction.status = "failed";
    transaction.refund_reason = reason;
    
    // Refund the amount back to wallet
    this.balance += transaction.amount;
    
    await this.save();
    return transaction;
};

export default mongoose.model("Wallet", walletSchema);