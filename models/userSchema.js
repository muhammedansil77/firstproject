// models/userSchema.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema({
    fullName: {
        type: String,
        required: function() {
            return !this.googleId;
        },
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        sparse: true
    },
    password: {
        type: String,
        required: function() {
            return !this.googleId;
        }
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    googleProfile: {
        type: Object,
        default: null
    },
    profilePicture: {
        type: String,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    
    // REFERRAL FIELDS - Add these
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralPoints: {
        type: Number,
        default: 0
    },
    totalReferrals: {
        type: Number,
        default: 0
    },
    referralEarnings: {
        type: Number,
        default: 0
    },
    referralLink: {
        type: String
    },
    referralStats: {
        totalReferred: { type: Number, default: 0 },
        successfulReferrals: { type: Number, default: 0 },
        pendingReferrals: { type: Number, default: 0 }
    },
    // END REFERRAL FIELDS
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    otp: { 
        type: String 
    },
    otpExpires: { 
        type: Date 
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    lastLogin: {
        type: Date,
        default: null
    },
    pendingEmail: {
        type: String,
        default: null
    },
    emailChangeOtp: {
        type: String,
        default: null
    },
    emailChangeOtpExpiry: {
        type: Date,
        default: null
    },
    phone: {
        type: String,
        default: null
    },
});

// Generate referral code before saving
userSchema.pre('save', function(next) {
    // Generate referral code for all users (except those who already have one)
    if (!this.referralCode && !this.googleId) {
        this.referralCode = this.generateReferralCode();
    }
    
    // Generate referral link
    if (!this.referralLink && this.referralCode) {
        this.referralLink = `${process.env.BASE_URL || 'http://localhost:3000'}/signup?ref=${this.referralCode}`;
    }
    
    next();
});

// Method to generate referral code
userSchema.methods.generateReferralCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Method to check if referral code is valid
userSchema.statics.isValidReferralCode = async function(code) {
    if (!code || code.length !== 8) return false;
    const user = await this.findOne({ referralCode: code });
    return !!user;
};

const User = mongoose.model("User", userSchema);
export default User;