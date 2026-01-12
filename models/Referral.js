// models/Referral.js
import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referredUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    referralCode: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    rewardAmount: {
        type: Number,
        default: 100
    },
    rewardType: {
        type: String,
        enum: ['cash', 'points', 'discount'],
        default: 'cash'
    },
    rewardStatus: {
        type: String,
        enum: ['pending', 'credited', 'rejected'],
        default: 'pending'
    },
    creditedAt: {
        type: Date
    },
    conditions: {
        firstPurchase: {
            type: Boolean,
            default: false
        },
        minimumPurchase: {
            type: Number,
            default: 0
        },
        signupBonus: {
            type: Boolean,
            default: true
        }
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;