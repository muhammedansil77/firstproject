// module.exports = function adminAuth(req, res, next) {
//   try {
 
//     if (
//       req.originalUrl.startsWith('/admin/login') ||
//       req.originalUrl.startsWith('/admin/logout')
//     ) {
//       return next();
//     }

  
//     if (req.session?.adminLoggedIn && req.session?.adminId) {
//       req.session.lastActivity = Date.now();
//       return next();
//     }

  
//     // if (req.session?.isLoggedIn && req.session?.userId) {
//     //   console.log('🚫 User session tried to access admin:', req.originalUrl);
//     //   return res.redirect('/user');
//     // }

//     console.log(`❌ ADMIN AUTH FAILED: ${req.method} ${req.originalUrl}`);

//     const isAjax =
//       req.xhr ||
//       req.headers.accept?.includes('application/json');

//     if (isAjax) {
//       return res.status(401).json({
//         success: false,
//         message: 'Admin session expired',
//         redirect: '/admin/login'
//       });
//     }

//     req.session.returnTo = req.originalUrl;
//     return res.redirect('/admin/login');

//   } catch (err) {
//     console.error('adminAuth error:', err);

//     if (req.headers.accept?.includes('application/json')) {
//       return res.status(401).json({
//         success: false,
//         message: 'Authentication error'
//       });
//     }

//     return res.redirect('/admin/login');
//   }
// };
const adminAuth = (req, res, next) => {
  try {
    if (
      req.originalUrl.startsWith('/admin/login') ||
      req.originalUrl.startsWith('/admin/logout')
    ) {
      return next();
    }

    if (req.session?.adminLoggedIn && req.session?.adminId) {
      req.session.lastActivity = Date.now();
      return next();
    }

    console.log(` ADMIN AUTH FAILED: ${req.method} ${req.originalUrl}`);

    const isAjax =
      req.xhr ||
      req.headers.accept?.includes('application/json');

    if (isAjax) {
      return res.status(401).json({
        success: false,
        message: 'Admin session expired',
        redirect: '/admin/login'
      });
    }

    req.session.returnTo = req.originalUrl;
    return res.redirect('/admin/login');

  } catch (err) {
    console.error('adminAuth error:', err);

    if (req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication error'
      });
    }

    return res.redirect('/admin/login');
  }
};

export default adminAuth;
