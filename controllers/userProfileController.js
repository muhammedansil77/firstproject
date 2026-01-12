import User from '../models/userSchema.js';
import Address from '../models/Address.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { sendOtpEmail } from "../helpers/mail.js";


export const loadProfile = async (req, res) => {
  try {
   
    
    if (!req.session.userId) {
     
      return res.redirect('/login');
    }
    
    const userId = req.session.userId;
  
    
    const user = await User.findById(userId).select('-password');
  
    
    const addresses = await Address.find({ userId: userId }).lean();
  
    res.render('user/pages/profile', {
      user,
      addresses,
      title: 'My Profile',
       pageJs: "profile.js"
    });
    

    
  } catch (error) {
    console.error('Profile load error:', error);

    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fullName, phone } = req.body;

    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Full name is required'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName: fullName.trim(),
        phone: phone || null
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
};



export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    } 

    const imagePath = `/uploads/${req.file.filename}`;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: imagePath },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile image updated',
      profilePicture: imagePath
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image'
    });
  }
};



export const initiateEmailChange = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { newEmail } = req.body;

    const otp = crypto.randomInt(100000, 999999).toString();

    await User.findByIdAndUpdate(userId, {
      pendingEmail: newEmail,
      emailChangeOtp: otp,
      emailChangeOtpExpiry: Date.now() + 10 * 60 * 1000
    });

    await sendOtpEmail(newEmail, otp);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

export const verifyEmailChange = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (
      user.emailChangeOtp !== req.body.otp ||
      Date.now() > user.emailChangeOtpExpiry
    ) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailChangeOtp = null;
    user.emailChangeOtpExpiry = null;

    await user.save();

    res.json({ success: true, email: user.email });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};



export const changePassword = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(userId);
    
  
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    
   
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
   
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      updatedAt: Date.now()
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
};


export const updateAccountSettings = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { twoFactorEnabled, loginNotifications } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      'settings.twoFactorEnabled': twoFactorEnabled || false,
      'settings.loginNotifications': loginNotifications || false,
      updatedAt: Date.now()
    });
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
    
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ success: false, message: 'Error updating settings' });
  }
};
// "user/pages/wallet"
//     pageJs: 'wallet.js',