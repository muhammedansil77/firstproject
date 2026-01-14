
import User from "../models/userSchema.js";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "../helpers/mailhelper.js";
import path from 'path';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Variant from '../models/Variant.js';
import Referral from "../models/Referral.js";
import Wallet from "../models/Wallet.js";


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

function loadModel(relPath) {
  try {
    const abs = path.join(process.cwd(), relPath);
    const mod = require(abs);
    return mod?.default || mod;
  } catch (err) {

    try {
      const modelName = path.basename(relPath).replace(/\.js$/, '');
      if (mongoose.modelNames().includes(modelName)) {
        return mongoose.model(modelName);
      }
    } catch (e) {

    }
    console.warn('loadModel failed for', relPath, err && err.message);
    return null;
  }
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;


    if (!email && !password) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please enter email and password"));
    }

    if (!email) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please enter your email"));
    }

    if (!password) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please enter your password"));
    }


    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Invalid email or password"));
    }


    if (!user.isVerified) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please verify your email first"));
    }

    if (user.isBlocked) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Your account is blocked"));
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect(303, "/user/login?error=" + encodeURIComponent("Invalid email or password"));
    }


    req.session.userId = user._id;
    req.session.isLoggedIn = true;
    req.session.fullName = user.fullName || null;

    return req.session.save(err => {
      if (err) {
        console.error("session save error (login):", err);
        return res.redirect(303, "/user/login?error=" + encodeURIComponent("Session error. Please try again."));
      }
      return res.redirect(303, "/user");
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.redirect(303, "/user/login?error=" + encodeURIComponent("Server error. Try again later."));
  }
};




const loadLoginPage = (req, res) => {

  if (req.session && req.session.isLoggedIn && req.session.userId) {
    return res.redirect('/user/home');
  }

  return res.render("user/auth/login", {
    layout: false,
    error: req.query.error || null,
    success: req.query.success || null,
    pageCss: "login.css",
    pageJs: "sci"
  });
};

const loadSignUp = async (req, res) => {
  try {
    let referralInfo = null;


    if (req.query.ref) {
      const referralCode = req.query.ref.toUpperCase().trim();


      const referrer = await User.findOne({
        referralCode: referralCode,
        isBlocked: false
      });

      if (referrer) {
        referralInfo = {
          code: referralCode,
          referrerName: referrer.fullName,
          isValid: true
        };
      } else {
        referralInfo = {
          code: referralCode,
          isValid: false
        };
      }
    }

    return res.render("user/auth/signup", {
      layout: false,
      title: "LuxTime - Create Account",
      message: req.query.error,
      old: req.session.oldData || {},
      showSuccess: req.query.success || false,
      referralInfo: referralInfo,
      pageJs: "script.js"
    });
  } catch (error) {
    console.error('Error loading signup page:', error);
    return res.render("user/auth/signup", {
      layout: false,
      title: "LuxTime - Create Account",
      message: "Error loading page",
      old: {},
      showSuccess: false,
      referralInfo: null
    });
  }
};

const signup = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, referralCode } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.redirect("/user/signup?error=" + encodeURIComponent("All fields are required"));
    }

    if (password !== confirmPassword) {
      return res.redirect("/user/signup?error=" + encodeURIComponent("Passwords do not match"));
    }

    const normalizedEmail = email.toLowerCase().trim();


    const existingUser = await User.findOne({
      email: normalizedEmail,
      isVerified: true
    });

    if (existingUser) {
      return res.redirect("/user/signup?error=" + encodeURIComponent("Email already registered"));
    }


    const unverifiedUser = await User.findOne({
      email: normalizedEmail,
      isVerified: false
    });


    if (unverifiedUser) {
      await User.findByIdAndDelete(unverifiedUser._id);
    }


    if (referralCode && referralCode.trim() !== '') {
      const validReferralCode = referralCode.trim().toUpperCase();


      const referrer = await User.findOne({
        referralCode: validReferralCode,
        isBlocked: false
      });

      if (!referrer) {
        return res.redirect("/user/signup?error=" + encodeURIComponent("Invalid referral code"));
      }


      if (referrer.email === normalizedEmail) {
        return res.redirect("/user/signup?error=" + encodeURIComponent("You cannot use your own referral code"));
      }
    }

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    const hashedPassword = await bcrypt.hash(password, 10);


    req.session.tempUserData = {
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      otp,
      otpExpires,
      referralCode: referralCode ? referralCode.trim().toUpperCase() : null
    };


    return req.session.save(async (saveErr) => {
      if (saveErr) {
        console.error("session save error (signup)", saveErr);
        return res.redirect("/user/signup?error=" + encodeURIComponent("Server error"));
      }


      try {
        await sendOtpEmail(normalizedEmail, otp);
      } catch (e) {
        console.error("sendOtpEmail signup:", e);

      }

      return res.redirect("/user/verify-otp");
    });

  } catch (err) {
    console.error("Signup Error:", err);
    return res.redirect("/user/signup?error=" + encodeURIComponent("Server error"));
  }
};


const loadVerifyOtpPage = async (req, res) => {
  try {
    if (!req.session.tempUserData) {
      return res.redirect("/user/signup");
    }

    return res.render("user/auth/verify-otp", {
      layout: false,
      otpEmail: req.session.tempUserData.email
    });

  } catch (err) {
    console.error("loadVerifyOtpPage error:", err);
    return res.redirect("/user/signup");
  }
};


const verifyOtp = async (req, res) => {
  const { otp } = req.body;

  try {

    if (!req.session.tempUserData) {
      return res.json({
        success: false,
        message: "Session expired. Please start again."
      });
    }


    const {
      fullName,
      email,
      password,
      otp: storedOtp,
      otpExpires,
      referralCode
    } = req.session.tempUserData;


    if (!storedOtp || storedOtp !== otp || otpExpires < Date.now()) {
      return res.json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }


    const existingVerifiedUser = await User.findOne({
      email: email,
      isVerified: true
    });

    if (existingVerifiedUser) {

      delete req.session.tempUserData;
      await req.session.save();

      return res.json({
        success: false,
        message: "This email is already registered and verified. Please login."
      });
    }


    const newUser = new User({
      fullName,
      email,
      password,
      isVerified: true,
      otp: undefined,
      otpExpires: undefined
    });

    await newUser.save();

    console.log('✅ New user created:', newUser.email);


    if (referralCode && referralCode.trim() !== '') {
      try {
        console.log('🔄 Processing referral code:', referralCode);


        const referrer = await User.findOne({
          referralCode: referralCode.toUpperCase(),
          isBlocked: false,
          _id: { $ne: newUser._id }
        });

        if (referrer) {
          console.log('✅ Referrer found:', referrer.email);


          const existingReferral = await Referral.findOne({
            referrer: referrer._id,
            referredUser: newUser._id
          });

          if (!existingReferral) {

            const referralRecord = await Referral.create({
              referrer: referrer._id,
              referredUser: newUser._id,
              referralCode: referralCode.toUpperCase(),
              status: 'completed',
              rewardAmount: 100,
              rewardType: 'cash',
              rewardStatus: 'credited',
              creditedAt: new Date(),
              conditions: {
                signupBonus: true,
                firstPurchase: false
              }
            });

            console.log('✅ Referral record created:', referralRecord._id);


            await User.findByIdAndUpdate(referrer._id, {
              $inc: {
                totalReferrals: 1,
                referralPoints: 100,
                referralEarnings: 100
              }
            });


            await User.findByIdAndUpdate(newUser._id, {
              referredBy: referrer._id
            });


            let referrerWallet = await Wallet.findOne({ user: referrer._id });

            if (!referrerWallet) {

              referrerWallet = await Wallet.create({
                user: referrer._id,
                balance: 100,
                transactions: [{
                  amount: 100,
                  type: 'credit',
                  description: `Referral bonus for ${newUser.email}`,
                  status: 'success',
                  payment_method: 'referral',
                  referred_user: newUser._id,
                  createdAt: new Date()
                }]
              });
              console.log('💰 Created new wallet for referrer with ₹100');
            } else {

              referrerWallet.balance += 100;
              referrerWallet.transactions.push({
                amount: 100,
                type: 'credit',
                description: `Referral bonus for ${newUser.email}`,
                status: 'success',
                payment_method: 'referral',
                referred_user: newUser._id,
                createdAt: new Date()
              });
              await referrerWallet.save();
              console.log('💰 ₹100 credited to referrer wallet. New balance:', referrerWallet.balance);
            }


            let newUserWallet = await Wallet.findOne({ user: newUser._id });

            if (!newUserWallet) {
              newUserWallet = await Wallet.create({
                user: newUser._id,
                balance: 100,
                transactions: [{
                  amount: 100,
                  type: 'credit',
                  description: `Welcome bonus for signing up with referral`,
                  status: 'success',
                  payment_method: 'signup_bonus',
                  createdAt: new Date()
                }]
              });
              console.log('💰 Created new wallet for user with ₹100 welcome bonus');
            } else {
              newUserWallet.balance += 100;
              newUserWallet.transactions.push({
                amount: 100,
                type: 'credit',
                description: `Welcome bonus for signing up with referral`,
                status: 'success',
                payment_method: 'signup_bonus',
                createdAt: new Date()
              });
              await newUserWallet.save();
              console.log('💰 ₹100 welcome bonus credited to new user wallet');
            }
          } else {
            console.log('ℹ️ Referral already exists');
          }
        } else {
          console.log('❌ Referrer not found for code:', referralCode);
        }
      } catch (referralError) {
        console.error('❌ Referral processing error:', referralError);

      }
    } else {
      console.log('ℹ️ No referral code provided');
    }


    delete req.session.tempUserData;


    req.session.userId = newUser._id;
    req.session.userName = newUser.fullName;

    return req.session.save((err) => {
      if (err) {
        console.error("session save error (verifyOtp)", err);
        return res.json({
          success: false,
          message: "Server error"
        });
      }


      return res.json({
        success: true,
        message: "Account created successfully!",
        redirect: "/user/login"
      });
    });

  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.json({
      success: false,
      message: "Server error"
    });
  }
};


const resendOtp = async (req, res) => {
  try {
    if (!req.session.tempUserData) {
      return res.json({
        success: false,
        message: "No active session"
      });
    }

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;


    req.session.tempUserData.otp = otp;
    req.session.tempUserData.otpExpires = otpExpires;


    await req.session.save();


    try {
      await sendOtpEmail(req.session.tempUserData.email, otp);
    } catch (e) {
      console.error("resendOtp email error", e);

    }

    return res.json({
      success: true,
      message: "New OTP sent!"
    });

  } catch (err) {
    console.error("resendOtp error:", err);
    return res.json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
};


const loadForgotPassword = (req, res) => {
  return res.render("user/auth/forgot-password", { layout: false, error: req.query.error || null, success: req.query.success || null });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Please enter your email"));

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Please enter a valid email address"));

    const user = await User.findOne({ email: normalizedEmail });
    const genericMessage = "If an account exists with this email, a reset code has been sent.";

    if (!user) {

      return res.redirect("/user/forgot-password?success=" + encodeURIComponent(genericMessage));
    }


    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();


    req.session.tempUserId = user._id;
    req.session.resetPasswordFlow = true;

    return req.session.save(async (saveErr) => {
      if (saveErr) console.error("session save error (forgotPassword)", saveErr);
      try { await sendOtpEmail(normalizedEmail, otp); console.log("OTP sent to", normalizedEmail); } catch (e) { console.error("sendOtpEmail forgot:", e); }
      return res.redirect("/user/forget-verify-otp");
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Server error"));
  }
};


const loadForgetVerifyOtpPage = async (req, res) => {
  try {
    if (!req.session.tempUserId) return res.redirect("/user/forgot-password");
    const user = await User.findById(req.session.tempUserId).select("email");
    if (!user) { delete req.session.tempUserId; return res.redirect("/user/forgot-password"); }
    return res.render("user/auth/forget-verify-otp",
      {
        layout: false,
        otpEmail: user.email,
        error: req.query.error || null
      });
  } catch (err) {
    console.error("loadForgetVerifyOtpPage error:", err);
    return res.redirect("/user/forgot-password");
  }
};

const loadResetPassword = (req, res) => {

  if (!req.session.tempUserId || !req.session.resetPasswordFlow) {
    return res.redirect("/user/forgot-password");
  }
  return res.render("user/auth/change-password", { layout: false, error: req.query.error || null });
};

const changePassword = async (req, res) => {
  try {
    if (!req.session.tempUserId || !req.session.resetPasswordFlow) {
      return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Session expired"));
    }

    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Please enter password fields"));
    if (password !== confirmPassword) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Passwords do not match"));
    if (password.length < 8) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Password must be at least 8 characters"));

    const user = await User.findById(req.session.tempUserId);
    if (!user) return res.redirect("/user/reset-password?error=" + encodeURIComponent("User not found"));

    user.password = await bcrypt.hash(password, 10);
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    delete req.session.tempUserId;
    delete req.session.resetPasswordFlow;

    return res.redirect("/user/login?success=" + encodeURIComponent("Password changed successfully! You can now login."));
  } catch (err) {
    console.error("changePassword error:", err);
    return res.redirect("/user/reset-password?error=" + encodeURIComponent("Server error"));
  }
};


const logout = (req, res) => {
  delete req.session.userId;
  delete req.session.isLoggedIn;
  delete req.session.fullName;

  res.redirect("/user/login");
};



const loadHomePage = async (req, res) => {
  try {
    console.log('=== LOAD HOME PAGE (with Variants) ===');

    if (!Product || !Variant) {
      console.error('Models not loaded. Product:', !!Product, 'Variant:', !!Variant);
      return renderHomeWithFallback(res, 'Models not loaded');
    }


   const rawProducts = await Product.find({
  isDeleted: { $ne: true },
  status: 'active'
})

      .select('name price salePrice minPrice finalPrice regularPrice variants category')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    console.log(`Found ${rawProducts.length} products`);


    const productIds = rawProducts.map(p => p._id);

    const variants = await Variant.find({
      product: { $in: productIds },
      isListed: { $ne: false }
    })
      .select('product images image price salePrice stock color colour')
      .lean();

    console.log(`Found ${variants.length} variants for products`);


    const variantsByProduct = {};
    variants.forEach(v => {
      const productId = String(v.product);
      if (!variantsByProduct[productId]) {
        variantsByProduct[productId] = [];
      }
      variantsByProduct[productId].push(v);
    });


    const products = rawProducts.map(p => {
      const productId = String(p._id);
      const productVariants = variantsByProduct[productId] || [];

      console.log(`Processing product: ${p.name}, Variants: ${productVariants.length}`);


      let images = [];


      productVariants.forEach(v => {

        if (Array.isArray(v.images) && v.images.length > 0) {
          images.push(...v.images.filter(img => img && img.trim() !== ''));
        }

        else if (v.image && typeof v.image === 'string' && v.image.trim() !== '') {
          images.push(v.image.trim());
        }

        else if (Array.isArray(v.image) && v.image.length > 0) {
          images.push(...v.image.filter(img => img && img.trim() !== ''));
        }
      });


      images = [...new Set(images)];


      if (images.length === 0) {
        images = ['/uploads/placeholder.png'];
        console.log(`  - No variant images found, using placeholder`);
      } else {
        console.log(`  - Found ${images.length} images from variants`);
      }


      images = images.map(img => {
        const str = String(img).trim();
        if (str.startsWith('http://') || str.startsWith('https://')) {
          return str;
        }
        return str.startsWith('/') ? str : '/' + str;
      }).slice(0, 3);


      let price = 0;
      let minPrice = Infinity;


      const productPriceCandidates = [
        p.price,
        p.salePrice,
        p.minPrice,
        p.finalPrice,
        p.regularPrice
      ];

      for (const candidate of productPriceCandidates) {
        if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(Number(candidate))) {
          const numValue = Number(candidate);
          if (numValue > 0) {
            price = numValue;
            minPrice = Math.min(minPrice, numValue);
            console.log(`  - Using product price: ₹${price}`);
            break;
          }
        }
      }


      if (price === 0 && productVariants.length > 0) {
        productVariants.forEach(v => {
          const variantPriceCandidates = [
            v.price,
            v.salePrice
          ];

          variantPriceCandidates.forEach(candidate => {
            if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(Number(candidate))) {
              const numValue = Number(candidate);
              if (numValue > 0) {
                minPrice = Math.min(minPrice, numValue);
              }
            }
          });
        });

        if (minPrice !== Infinity) {
          price = minPrice;
          console.log(`  - Using min variant price: ₹${price}`);
        }
      }

      if (price === 0) {
        console.log(`  - No valid price found, defaulting to ₹0`);
      }

      return {
        _id: productId,
        name: p.name || 'Untitled Product',
        images: images,
        price: price,
        minPrice: price,
        variantsCount: productVariants.length,
        category: p.category || null
      };
    });

    console.log('=== RENDERING HOME PAGE ===');
    console.log(`Sending ${products.length} products to template`);

    if (products.length > 0) {
      const sample = products[0];
      console.log('Sample product:', {
        name: sample.name,
        imagesCount: sample.images.length,
        firstImage: sample.images[0],
        price: sample.price,
        variantsCount: sample.variantsCount
      });
    }

    return res.render('user/pages/home', {
      title: 'Home - Luxury Watches',
      layout: 'user/layouts/main',
      pageJS: 'ho',
      cssFile: '',
      products: products
    });

  } catch (error) {
    console.error('loadHomePage ERROR:', error);
    return renderHomeWithFallback(res, error.message);
  }
};


function renderHomeWithFallback(res, error = null) {
  const fallbackProducts = [
    {
      _id: 'demo-1',
      name: 'Sample Watch 1',
      images: ['/uploads/placeholder.png'],
      price: 29999,
      description: 'Sample description for testing'
    },
    {
      _id: 'demo-2',
      name: 'Sample Watch 2',
      images: ['/uploads/placeholder.png'],
      price: 39999,
      description: 'Another sample for testing'
    }
  ];

  return res.render('user/pages/home', {
    title: 'Home - Luxury Watches',
    layout: 'user/layouts/main',
    pageJS: 'home.js',
    cssFile: '/user/css/home.css',
    products: fallbackProducts,
    error: error
  });
}

const pageNotFound = (req, res) => {
  return res.render("user/pages/page-404");
};

const verifyForgotOtp = async (req, res) => {
  const { otp } = req.body;

  try {

    if (!req.session.tempUserId || !req.session.resetPasswordFlow) {
      return res.json({ success: false, message: "Session expired. Please start again." });
    }

    const user = await User.findById(req.session.tempUserId);
    if (!user) {

      delete req.session.tempUserId;
      delete req.session.resetPasswordFlow;
      await req.session.save?.();
      return res.json({ success: false, message: "Session expired. Please start again." });
    }


    if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.json({ success: false, message: "Invalid or expired OTP" });
    }


    return res.json({ success: true, redirect: "/user/reset-password" });

  } catch (err) {
    console.error("verifyForgotOtp error:", err);
    return res.json({ success: false, message: "Server error" });
  }
};

const resendForgotOtp = async (req, res) => {
  try {
    if (!req.session.tempUserId) return res.json({ success: false, message: "No active session" });

    const user = await User.findById(req.session.tempUserId);
    if (!user) {
      delete req.session.tempUserId;
      delete req.session.resetPasswordFlow;
      await req.session.save?.(); return res.json({ success: false, message: "Session expired" });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    try { await sendOtpEmail(user.email, otp); } catch (e) { console.error("resend forgot email error", e); }

    return res.json({ success: true, message: "New OTP sent!" });
  } catch (err) {
    console.error("resendForgotOtp error:", err);
    return res.json({ success: false, message: "Failed to resend OTP" });
  }
};



export default {
  loadHomePage,
  logout,
  pageNotFound,
  loadLoginPage,
  loadSignUp,
  signup,
  loadVerifyOtpPage,
  resendForgotOtp,
  resendOtp,
  verifyForgotOtp,
  verifyOtp,
  login,
  loadForgotPassword,
  forgotPassword,
  loadForgetVerifyOtpPage,
  loadResetPassword,
  changePassword
};