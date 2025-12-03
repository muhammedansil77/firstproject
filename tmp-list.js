// // controllers/userController.js
// const User = require("../models/userSchema");
// const bcrypt = require("bcrypt");
// const { sendOtpEmail } = require("../helpers/mailhelper");
// const path = require('path');
// const mongoose = require('mongoose');

// const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// function loadModel(relPath) {
//   try {
//     const abs = path.join(process.cwd(), relPath);
//     const mod = require(abs);
//     return mod?.default || mod;
//   } catch (err) {
//     // fallback to mongoose registry by model name
//     try {
//       const modelName = path.basename(relPath).replace(/\.js$/, '');
//       if (mongoose.modelNames().includes(modelName)) {
//         return mongoose.model(modelName);
//       }
//     } catch (e) {
//       // ignore
//     }
//     console.warn('loadModel failed for', relPath, err && err.message);
//     return null;
//   }
// }

// // ---------- AUTH / LOGIN (PRG) ----------
// // controllers/userController.js - replace login
// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please enter email and password"));
//     }

//     const normalizedEmail = email.toLowerCase().trim();
//     const user = await User.findOne({ email: normalizedEmail });

//     if (!user) {
//       return res.redirect(303, "/user/login?error=" + encodeURIComponent("Invalid email or password"));
//     }

//     if (!user.isVerified) {
//       return res.redirect(303, "/user/login?error=" + encodeURIComponent("Please verify your email first"));
//     }

//     if (user.isBlocked) {
//       return res.redirect(303, "/user/login?error=" + encodeURIComponent("Your account is blocked"));
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.redirect(303, "/user/login?error=" + encodeURIComponent("Invalid email or password"));
//     }

//     // SUCCESS — set session and do 303
//     req.session.userId = user._id;
//     req.session.isLoggedIn = true;
//     req.session.fullName = user.fullName || null;

//     return req.session.save(err => {
//       if (err) console.error("session save error (login):", err);
//       return res.redirect(303, "/user/home");
//     });

//   } catch (error) {
//     console.error("Login Error:", error);
//     return res.redirect(303, "/user/login?error=" + encodeURIComponent("Server error. Try again later."));
//   }
// };


// // GET login page (reads query params)
// // controllers/userController.js - Update loadLoginPage function

// const loadLoginPage = (req, res) => {
//   // If user is already logged in, redirect to home
//   if (req.session && req.session.isLoggedIn && req.session.userId) {
//     return res.redirect('/user/home');
//   }
  
//   return res.render("user/auth/login", {
//     layout: false,
//     error: req.query.error || null,
//     success: req.query.success || null,
//      pageCss: "login.css",
//   pageJs: "sci"
//   });
// };
// // ---------- SIGNUP (PRG) ----------
// const loadSignUp = (req, res) => {
//   // Optional: Redirect if already logged in
//   // if (req.session && req.session.isLoggedIn === true && req.session.userId) {
//   //   return res.redirect('/user/home');
//   // }

//   return res.render("user/auth/signup", {
//     layout: false,  // Since we have complete HTML in signup.ejs
//     title: "LuxTime - Create Account",
//     message: req.query.error,
//     old: req.session.oldData || {},
//     showSuccess: req.query.success || false
//   });
// };

// const signup = async (req, res) => {
//   try {
//     const { fullName, email, password, confirmPassword } = req.body;
//     if (!fullName || !email || !password || !confirmPassword) {
//       return res.redirect("/user/signup?error=" + encodeURIComponent("All fields are required"));
//     }
//     if (password !== confirmPassword) {
//       return res.redirect("/user/signup?error=" + encodeURIComponent("Passwords do not match"));
//     }
//     const normalizedEmail = email.toLowerCase().trim();
//     const existingUser = await User.findOne({ email: normalizedEmail });
//     if (existingUser) return res.redirect("/user/signup?error=" + encodeURIComponent("Email already registered"));

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const otp = generateOTP();
//     const otpExpires = Date.now() + 10 * 60 * 1000;

//     const tempUser = new User({
//       fullName: fullName.trim(),
//       email: normalizedEmail,
//       password: hashedPassword,
//       otp,
//       otpExpires,
//       isVerified: false
//     });
//     await tempUser.save();

//     // set session so verify page can use it
//     req.session.tempUserId = tempUser._id;
//     // Save session before redirect to avoid races
//     return req.session.save(async (saveErr) => {
//       if (saveErr) console.error("session save error (signup)", saveErr);
//       // send OTP (don't block user if email fails)
//       try { await sendOtpEmail(normalizedEmail, otp); } catch (e) { console.error("sendOtpEmail signup:", e); }
//       return res.redirect("/user/verify-otp");
//     });
//   } catch (err) {
//     console.error("Signup Error:", err);
//     return res.redirect("/user/signup?error=" + encodeURIComponent("Server error"));
//   }
// };

// // GET verify page
// const loadVerifyOtpPage = async (req, res) => {
//   try {
//     if (!req.session.tempUserId) return res.redirect("/user/signup");
//     const user = await User.findById(req.session.tempUserId).select("email");
//     if (!user) {
//       delete req.session.tempUserId;
//       return res.redirect("/user/signup");
//     }
//     return res.render("user/auth/verify-otp", { layout: false, otpEmail: user.email });
//   } catch (err) {
//     console.error("loadVerifyOtpPage error:", err);
//     return res.redirect("/user/signup");
//   }
// };

// // ---------- VERIFY OTP (handles forgot-password flow when resetPasswordFlow set) ----------
// // This returns JSON (used by your fetch on OTP page)
// const verifyOtp = async (req, res) => {
//   const { otp } = req.body;
//   try {
//     if (!req.session.tempUserId) {
//       return res.json({ success: false, message: "Session expired. Please start again." });
//     }

//     const user = await User.findById(req.session.tempUserId);
//     if (!user) return res.json({ success: false, message: "User not found" });

//     if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
//       return res.json({ success: false, message: "Invalid or expired OTP" });
//     }

//     // If reset flow: clear otp, keep tempUserId and redirect to reset page
//     if (req.session.resetPasswordFlow) {
//       user.otp = undefined; user.otpExpires = undefined;
//       await user.save();
//       return req.session.save((err) => {
//         if (err) console.error("session save error (verifyOtp reset)", err);
//         return res.json({ success: true, redirect: "/user/reset-password" });
//       });
//     }

// user.isVerified = true;
// user.otp = undefined;
// user.otpExpires = undefined;
// await user.save();

// // clear the temp session marker used during signup
// delete req.session.tempUserId;

// // Save session (to persist removal of tempUserId) and tell client to go to login page
// return req.session.save((err) => {
//   if (err) console.error("session save error (verifyOtp signup)", err);

//   // SHOW SUCCESS MESSAGE ON LOGIN PAGE
//   const successMsg = encodeURIComponent("Account created successfully! Please log in.");

//   return res.json({
//     success: true,
//     redirect: "/user/login?success=" + successMsg
//   });
// }); } catch (err) {
//     console.error("verifyOtp error:", err);
//     return res.json({ success: false, message: "Server error" });
//   }
// };

// // Resend OTP (JSON)
// const resendOtp = async (req, res) => {
//   try {
//     if (!req.session.tempUserId) return res.json({ success: false, message: "No active session" });
//     const user = await User.findById(req.session.tempUserId);
//     if (!user) { delete req.session.tempUserId; return res.json({ success: false, message: "User not found" }); }
//     const otp = generateOTP();
//     user.otp = otp; user.otpExpires = Date.now() + 10 * 60 * 1000;
//     await user.save();
//     try { await sendOtpEmail(user.email, otp); } catch (e) { console.error("resendOtp email error", e); }
//     return res.json({ success: true, message: "New OTP sent!" });
//   } catch (err) {
//     console.error("resendOtp error:", err);
//     return res.json({ success: false, message: "Failed to resend OTP" });
//   }
// };

// // ---------- FORGOT PASSWORD (PRG) ----------
// const loadForgotPassword = (req, res) => {
//   return res.render("user/auth/forgot-password", { layout: false, error: req.query.error || null, success: req.query.success || null });
// };

// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Please enter your email"));

//     const normalizedEmail = email.toLowerCase().trim();
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(normalizedEmail)) return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Please enter a valid email address"));

//     const user = await User.findOne({ email: normalizedEmail });
//     const genericMessage = "If an account exists with this email, a reset code has been sent.";

//     if (!user) {
//       // For non-existing user, show generic confirmation (PRG to avoid revealing existence)
//       return res.redirect("/user/forgot-password?success=" + encodeURIComponent(genericMessage));
//     }

//     // create OTP
//     const otp = generateOTP();
//     user.otp = otp;
//     user.otpExpires = Date.now() + 10 * 60 * 1000;
//     await user.save();

//     // mark reset flow
//     req.session.tempUserId = user._id;
//     req.session.resetPasswordFlow = true;

//     return req.session.save(async (saveErr) => {
//       if (saveErr) console.error("session save error (forgotPassword)", saveErr);
//       try { await sendOtpEmail(normalizedEmail, otp); console.log("OTP sent to", normalizedEmail); } catch (e) { console.error("sendOtpEmail forgot:", e); }
//       return res.redirect("/user/forget-verify-otp"); // GET page that shows OTP entry (PRG)
//     });
//   } catch (err) {
//     console.error("forgotPassword error:", err);
//     return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Server error"));
//   }
// };

// // GET page where user enters OTP for forgot-password
// const loadForgetVerifyOtpPage = async (req, res) => {
//   try {
//     if (!req.session.tempUserId) return res.redirect("/user/forgot-password");
//     const user = await User.findById(req.session.tempUserId).select("email");
//     if (!user) { delete req.session.tempUserId; return res.redirect("/user/forgot-password"); }
//     return res.render("user/auth/forget-verify-otp", { layout: false, otpEmail: user.email, error: req.query.error || null });
//   } catch (err) {
//     console.error("loadForgetVerifyOtpPage error:", err);
//     return res.redirect("/user/forgot-password");
//   }
// };

// // ---------- RESET PASSWORD (GET & POST - PRG) ----------
// const loadResetPassword = (req, res) => {
//   // Only render if reset flow active
//   if (!req.session.tempUserId || !req.session.resetPasswordFlow) {
//     return res.redirect("/user/forgot-password");
//   }
//   return res.render("user/auth/change-password", { layout: false, error: req.query.error || null });
// };

// const changePassword = async (req, res) => {
//   try {
//     if (!req.session.tempUserId || !req.session.resetPasswordFlow) {
//       return res.redirect("/user/forgot-password?error=" + encodeURIComponent("Session expired"));
//     }

//     const { password, confirmPassword } = req.body;
//     if (!password || !confirmPassword) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Please enter password fields"));
//     if (password !== confirmPassword) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Passwords do not match"));
//     if (password.length < 8) return res.redirect("/user/reset-password?error=" + encodeURIComponent("Password must be at least 8 characters"));

//     const user = await User.findById(req.session.tempUserId);
//     if (!user) return res.redirect("/user/reset-password?error=" + encodeURIComponent("User not found"));

//     user.password = await bcrypt.hash(password, 10);
//     user.isVerified = true;
//     user.otp = undefined;
//     user.otpExpires = undefined;
//     await user.save();

//     // clear reset session flags
//     delete req.session.tempUserId;
//     delete req.session.resetPasswordFlow;

//     return res.redirect("/user/login?success=" + encodeURIComponent("Password changed successfully! You can now login."));
//   } catch (err) {
//     console.error("changePassword error:", err);
//     return res.redirect("/user/reset-password?error=" + encodeURIComponent("Server error"));
//   }
// };

// // ---------- LOGOUT ----------
// const logout = (req, res) => {
//   res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
//   res.set('Pragma', 'no-cache');
//   res.set('Expires', '0');

//   req.session.destroy(err => {
//     if (err) {
//       console.error("Logout error:", err);
//       return res.redirect("/user/home");
//     }
//     res.clearCookie("connect.sid", { path: '/' });
//     return res.redirect(303, "/user/login");
//   });
// };


// // ---------- MISC ----------
// const Product = loadModel('models/Product'); // safe loader
// const Variant  = loadModel('models/Variant');

// // In userController.js - Update loadHomePage function
// const loadHomePage = async (req, res) => {
//   try {
//     console.log('=== LOAD HOME PAGE (with Variants) ===');
    
//     // Check if models are loaded
//     if (!Product || !Variant) {
//       console.error('Models not loaded. Product:', !!Product, 'Variant:', !!Variant);
//       return renderHomeWithFallback(res, 'Models not loaded');
//     }

//     // Get products with their variants
//     const rawProducts = await Product.find({
//       isDeleted: { $ne: true },
//       isBlocked: { $ne: true },
//       isListed: { $ne: false }
//     })
//     .select('name price salePrice minPrice finalPrice regularPrice variants category')
//     .sort({ createdAt: -1 })
//     .limit(8)
//     .lean();

//     console.log(`Found ${rawProducts.length} products`);

//     // Get all product IDs to fetch their variants
//     const productIds = rawProducts.map(p => p._id);
    
//     // Fetch variants for these products
//     const variants = await Variant.find({
//       product: { $in: productIds },
//       isListed: { $ne: false }
//     })
//     .select('product images image price salePrice stock color colour')
//     .lean();

//     console.log(`Found ${variants.length} variants for products`);

//     // Group variants by product
//     const variantsByProduct = {};
//     variants.forEach(v => {
//       const productId = String(v.product);
//       if (!variantsByProduct[productId]) {
//         variantsByProduct[productId] = [];
//       }
//       variantsByProduct[productId].push(v);
//     });

//     // Process products with variant data
//     const products = rawProducts.map(p => {
//       const productId = String(p._id);
//       const productVariants = variantsByProduct[productId] || [];
      
//       console.log(`Processing product: ${p.name}, Variants: ${productVariants.length}`);
      
//       // === IMAGE HANDLING FROM VARIANTS ===
//       let images = [];
      
//       // Collect images from all variants
//       productVariants.forEach(v => {
//         // Check variant.images (array)
//         if (Array.isArray(v.images) && v.images.length > 0) {
//           images.push(...v.images.filter(img => img && img.trim() !== ''));
//         }
//         // Check variant.image (single)
//         else if (v.image && typeof v.image === 'string' && v.image.trim() !== '') {
//           images.push(v.image.trim());
//         }
//         // Check variant.image (array)
//         else if (Array.isArray(v.image) && v.image.length > 0) {
//           images.push(...v.image.filter(img => img && img.trim() !== ''));
//         }
//       });
      
//       // Remove duplicates
//       images = [...new Set(images)];
      
//       // If still no images, use placeholder
//       if (images.length === 0) {
//         images = ['/uploads/placeholder.png'];
//         console.log(`  - No variant images found, using placeholder`);
//       } else {
//         console.log(`  - Found ${images.length} images from variants`);
//       }
      
//       // Normalize image paths
//       images = images.map(img => {
//         const str = String(img).trim();
//         if (str.startsWith('http://') || str.startsWith('https://')) {
//           return str;
//         }
//         return str.startsWith('/') ? str : '/' + str;
//       }).slice(0, 3); // Limit to 3 images
      
//       // === PRICE HANDLING ===
//       let price = 0;
//       let minPrice = Infinity;
      
//       // Check product prices first
//       const productPriceCandidates = [
//         p.price,
//         p.salePrice,
//         p.minPrice,
//         p.finalPrice,
//         p.regularPrice
//       ];
      
//       for (const candidate of productPriceCandidates) {
//         if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(Number(candidate))) {
//           const numValue = Number(candidate);
//           if (numValue > 0) {
//             price = numValue;
//             minPrice = Math.min(minPrice, numValue);
//             console.log(`  - Using product price: ₹${price}`);
//             break;
//           }
//         }
//       }
      
//       // If no product price, check variant prices
//       if (price === 0 && productVariants.length > 0) {
//         productVariants.forEach(v => {
//           const variantPriceCandidates = [
//             v.price,
//             v.salePrice
//           ];
          
//           variantPriceCandidates.forEach(candidate => {
//             if (candidate !== undefined && candidate !== null && candidate !== '' && !isNaN(Number(candidate))) {
//               const numValue = Number(candidate);
//               if (numValue > 0) {
//                 minPrice = Math.min(minPrice, numValue);
//               }
//             }
//           });
//         });
        
//         if (minPrice !== Infinity) {
//           price = minPrice;
//           console.log(`  - Using min variant price: ₹${price}`);
//         }
//       }
      
//       if (price === 0) {
//         console.log(`  - No valid price found, defaulting to ₹0`);
//       }
      
//       return {
//         _id: productId,
//         name: p.name || 'Untitled Product',
//         images: images,
//         price: price,
//         minPrice: price,
//         variantsCount: productVariants.length,
//         category: p.category || null
//       };
//     });

//     console.log('=== RENDERING HOME PAGE ===');
//     console.log(`Sending ${products.length} products to template`);
    
//     if (products.length > 0) {
//       const sample = products[0];
//       console.log('Sample product:', {
//         name: sample.name,
//         imagesCount: sample.images.length,
//         firstImage: sample.images[0],
//         price: sample.price,
//         variantsCount: sample.variantsCount
//       });
//     }

//     return res.render('user/pages/home', {
//       title: 'Home - Luxury Watches',
//       layout: 'user/layouts/main',
//       pageJS: 'ho',
//       cssFile: '',
//       products: products
//     });

//   } catch (error) {
//     console.error('loadHomePage ERROR:', error);
//     return renderHomeWithFallback(res, error.message);
//   }
// };

// // Helper function remains the same
// function renderHomeWithFallback(res, error = null) {
//   const fallbackProducts = [
//     {
//       _id: 'demo-1',
//       name: 'Sample Watch 1',
//       images: ['/uploads/placeholder.png'],
//       price: 29999,
//       description: 'Sample description for testing'
//     },
//     {
//       _id: 'demo-2',
//       name: 'Sample Watch 2',
//       images: ['/uploads/placeholder.png'],
//       price: 39999,
//       description: 'Another sample for testing'
//     }
//   ];
  
//   return res.render('user/pages/home', {
//     title: 'Home - Luxury Watches',
//     layout: 'user/layouts/main',
//     pageJS: 'home.js',
//     cssFile: '/user/css/home.css',
//     products: fallbackProducts,
//     error: error
//   });
// }

// const pageNotFound = (req, res) => {
//   return res.render("user/pages/page-404");
// };

// module.exports = {
//   loadHomePage,
//   logout,
//   pageNotFound,
//   loadLoginPage,
//   loadSignUp,
//   signup,
//   loadVerifyOtpPage,
//   resendOtp,
  
//   verifyOtp,
//   login,
//   loadForgotPassword,
//   forgotPassword,
//   loadForgetVerifyOtpPage,
//   loadResetPassword,
//   changePassword
// };
