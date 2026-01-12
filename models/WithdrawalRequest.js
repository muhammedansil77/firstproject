import mongoose from 'mongoose';

const withdrawalRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    wallet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 100 // Minimum withdrawal ₹100
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed'],
        default: 'pending'
    },
    payment_method: {
        type: String,
        enum: ['upi', 'bank_transfer', 'paytm', 'phonepe', 'gpay'],
        required: true
    },
    payment_details: {
        upi_id: String,
        bank_name: String,
        account_number: String,
        ifsc_code: String,
        account_holder: String,
        phonepe: String,
        gpay: String,
        paytm: String
    },
    transaction_id: String,
    admin_notes: String,
    processed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processed_at: Date,
    rejection_reason: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
export default WithdrawalRequest;