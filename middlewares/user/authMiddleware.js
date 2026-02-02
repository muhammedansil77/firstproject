
import User from "../../models/userSchema.js";


export const attachUser = async (req, res, next) => {
  try {
    res.locals.isLoggedIn = false;
    res.locals.userName = null;
    req.user = null;

    if (!req.session?.userId) return next();

  
    const user = await User.findById(req.session.userId)
      .select("fullName email isBlocked")
      .lean();

    if (!user) {
      req.session.destroy(() => {});
      return next();
    }

    req.user = user;
    res.locals.isLoggedIn = true;
    res.locals.userName = user.fullName || user.email || null;

    return next();
  } catch (err) {
    console.error("attachUser error:", err);
    req.user = null;
    next();
  }
};


export const protectRoute = (req, res, next) => {

  // ✅ Public routes (NO login required)
  const publicRoutes = [
    '/',
    '/user',
    '/user/login',
    '/user/signup',
    '/user/verify-otp',
    '/user/forgot-password',
    '/user/reset-password',
    '/products',
    '/product'
  ];

  if (publicRoutes.some(route => req.path === route || req.path.startsWith(route + '/'))) {
    return next();
  }

  // ✅ Allow admin routes to be handled separately
  if (req.originalUrl.startsWith('/admin')) {
    return next();
  }

  // ✅ Logged-in users allowed
  if (req.session?.isLoggedIn && req.session?.userId) {
    return next();
  }

  // ❌ Not logged in → redirect to login
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Please login to continue'
    });
  }

  return res.redirect('/user/login');
};




export const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

export const preventCacheForAuth = (req, res, next) => {
  const isAdminRoute = req.originalUrl.startsWith('/admin');

  const isUserAuthPage =
    req.path.startsWith('/user/login') ||
    req.path.startsWith('/user/signup') ||
    req.path.startsWith('/user/verify-otp') ||
    req.path.startsWith('/user/forgot-password') ||
    req.path.startsWith('/user/reset-password');

  const isAdminAuthPage =
    req.path.startsWith('/admin/login');


  if (isUserAuthPage || isAdminAuthPage) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }


  if (isUserAuthPage && req.session?.isLoggedIn && req.session?.userId) {
    return res.redirect('/user');
  }


  if (isAdminAuthPage && req.session?.adminLoggedIn && req.session?.adminId) {
    return res.redirect('/admin/reports/dash');
  }

  next();
};


export const preventBackToAuth = (req, res, next) => {
  if (req.session?.isLoggedIn) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
};

export default {
  attachUser,
  protectRoute,
  noCache,
  preventCacheForAuth,
  preventBackToAuth
};
