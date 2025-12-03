const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    fullName: {
        type: String,
        required: function() {
            // Required only for non-Google signups
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
        sparse: true // Allows null for Google users if needed, but email is still required
    },
    password: {
        type: String,
        required: function() {
            // Required only for non-Google signups
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
        sparse: true // Allows multiple null values for non-Google users
    },
    googleProfile: {
        type: Object, // Store additional Google profile info
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
    // Automatically verify Google users
    verifiedAt: {
        type: Date,
        default: null
    },
    lastLogin: {
        type: Date,
        default: null
    }
});

const User = mongoose.model("User", userSchema);
module.exports = User;