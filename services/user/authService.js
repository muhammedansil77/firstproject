import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "../../helpers/mailhelper.js";
import path from 'path';
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Variant from '../../models/Variant.js';
import Referral from "../../models/Referral.js";
import Wallet from "../../models/Wallet.js";

export const loginUserService = async (email, password) => {
  // Field validation
  if (!email && !password) {
    return { success: false, error: "Please enter email and password" };
  }

  if (!email) {
    return { success: false, error: "Please enter your email" };
  }

  if (!password) {
    return { success: false, error: "Please enter your password" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.isVerified) {
    return { success: false, error: "Please verify your email first" };
  }

  if (user.isBlocked) {
    return { success: false, error: "Your account is blocked" };
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return { success: false, error: "Invalid email or password" };
  }

  return {
    success: true,
    user
  };
};
export const signupUserService = async ({
  fullName,
  email,
  password,
  confirmPassword,
  referralCode
}) => {

  if (!fullName || !email || !password || !confirmPassword) {
    return { success: false, error: "All fields are required" };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }

  const normalizedEmail = email.toLowerCase().trim();


  const existingUser = await User.findOne({
    email: normalizedEmail,
    isVerified: true
  });

  if (existingUser) {
    return { success: false, error: "Email already registered" };
  }


  const unverifiedUser = await User.findOne({
    email: normalizedEmail,
    isVerified: false
  });

  if (unverifiedUser) {
    await User.findByIdAndDelete(unverifiedUser._id);
  }


  let referrer = null;

  if (referralCode && referralCode.trim() !== "") {
    const validReferralCode = referralCode.trim().toUpperCase();

    referrer = await User.findOne({
      referralCode: validReferralCode,
      isBlocked: false
    });

    if (!referrer) {
      return { success: false, error: "Invalid referral code" };
    }

    if (referrer.email === normalizedEmail) {
      return { success: false, error: "You cannot use your own referral code" };
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return {
    success: true,
    data: {
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      referralCode: referralCode
        ? referralCode.trim().toUpperCase()
        : null
    }
  };
};
export const creditWalletService = async (userId, amount, description, session) => {
  let wallet = await Wallet.findOne({ user: userId }).session(session);

  if (!wallet) {
    wallet = await Wallet.create([{
      user: userId,
      balance: amount,
      transactions: [{
        amount,
        type: "credit",
        description,
        status: "success",
        createdAt: new Date()
      }]
    }], { session });
  } else {
    wallet.balance += amount;
    wallet.transactions.push({
      amount,
      type: "credit",
      description,
      status: "success",
      createdAt: new Date()
    });
    await wallet.save({ session });
  }
};
export const processReferralService = async (referralCode, newUser, session) => {

  if (!referralCode) return;

  const referrer = await User.findOne({
    referralCode: referralCode.toUpperCase(),
    isBlocked: false,
    _id: { $ne: newUser._id }
  }).session(session);

  if (!referrer) return;

  const existingReferral = await Referral.findOne({
    referrer: referrer._id,
    referredUser: newUser._id
  }).session(session);

  if (existingReferral) return;

  await Referral.create([{
    referrer: referrer._id,
    referredUser: newUser._id,
    referralCode: referralCode.toUpperCase(),
    status: "completed",
    rewardAmount: 100,
    rewardType: "cash",
    rewardStatus: "credited",
    creditedAt: new Date()
  }], { session });

  await User.findByIdAndUpdate(referrer._id, {
    $inc: {
      totalReferrals: 1,
      referralPoints: 100,
      referralEarnings: 100
    }
  }, { session });

  await User.findByIdAndUpdate(newUser._id, {
    referredBy: referrer._id
  }, { session });

  await creditWalletService(
    referrer._id,
    100,
    `Referral bonus for ${newUser.email}`,
    session
  );

  await creditWalletService(
    newUser._id,
    100,
    `Welcome bonus`,
    session
  );
};
export const verifyOtpService = async (sessionData, enteredOtp) => {

  if (!sessionData) {
    return { success: false, message: "Session expired. Please start again." };
  }

  const {
    fullName,
    email,
    password,
    otp,
    otpExpires,
    referralCode
  } = sessionData;

  if (!otp || otp !== enteredOtp || otpExpires < Date.now()) {
    return { success: false, message: "Invalid or expired OTP" };
  }

  const existingUser = await User.findOne({
    email,
    isVerified: true
  });

  if (existingUser) {
    return {
      success: false,
      message: "Email already verified. Please login."
    };
  }

  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {

    const newUser = await User.create([{
      fullName,
      email,
      password,
      isVerified: true
    }], { session: mongoSession });

    const createdUser = newUser[0];

    await processReferralService(
      referralCode,
      createdUser,
      mongoSession
    );

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    return {
      success: true,
      user: createdUser
    };

  } catch (error) {

    await mongoSession.abortTransaction();
    mongoSession.endSession();

    throw error;
  }
};