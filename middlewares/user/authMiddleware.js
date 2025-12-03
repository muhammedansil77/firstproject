// middlewares/user/authMiddleware.js

const User = require("../../models/userSchema");

// Attach user info to req/res.locals when logged-in
module.exports.attachUser = async (req, res, next) => {
  try {
    res.locals.isLoggedIn = false;
    res.locals.userName = null;

    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select("fullName email");
      if (user) {
        req.user = user;
        res.locals.isLoggedIn = true;
        res.locals.userName = user.fullName || user.email || null;
        req.session.fullName = req.session.fullName || user.fullName;
      }
    }
  } catch (err) {
    console.error("attachUser error:", err);
  }
  next();
};

module.exports.protectRoute = (req, res, next) => {
  if (req.session && req.session.isLoggedIn && req.session.userId) {
    return next();
  }
  // AJAX clients:
  if (req.xhr || (req.headers.accept || '').includes('application/json')) {
    return res.status(401).json({ ok: false, message: 'Authentication required' });
  }
  return res.redirect("/user/login");
};

// Updated noCache middleware - MORE AGGRESSIVE
module.exports.noCache = (req, res, next) => {
  // Set headers to prevent ALL caching
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private, proxy-revalidate, max-age=0');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('X-Accel-Expires', '0'); // For nginx
  res.header('Surrogate-Control', 'no-store');
  next();
};

// NEW: Special middleware for login/logout pages
module.exports.preventCacheForAuth = (req, res, next) => {
  // For auth pages only (login, signup, etc.)
  const isAuthPage = req.path.includes('/login') || 
                     req.path.includes('/signup') || 
                     req.path.includes('/verify-otp') ||
                     req.path.includes('/forgot-password') ||
                     req.path.includes('/reset-password');
  
  if (isAuthPage) {
    // Extra aggressive for auth pages
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private, proxy-revalidate, max-age=0');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('X-Accel-Expires', '0');
    res.header('Surrogate-Control', 'no-store');
    
    // If user is already logged in, redirect away from auth pages
    if (req.session && req.session.isLoggedIn && req.session.userId) {
      return res.redirect('/user/home');
    }
  }
  
  next();
};

// NEW: Middleware to prevent going back to cached auth pages
module.exports.preventBackToAuth = (req, res, next) => {
  // Check if this is a request for an auth page
  const isAuthPage = req.path.includes('/login') || 
                     req.path.includes('/signup') || 
                     req.path.includes('/verify-otp') ||
                     req.path.includes('/forgot-password') ||
                     req.path.includes('/reset-password');
  
  if (isAuthPage) {
    // Set headers to prevent any caching
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    // If user is logged in and trying to access auth pages, redirect to home
    if (req.session && req.session.isLoggedIn && req.session.userId) {
      return res.redirect('/user/home');
    }
  }
  
  // For protected pages, ensure they're not cached
  if (req.session && req.session.isLoggedIn) {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  
  next();
};