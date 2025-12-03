// middlewares/adminAuth.js
module.exports = function adminAuth(req, res, next) {
  try {
    // allow if session indicates admin logged in
    if (req.session && req.session.adminLoggedIn && req.session.adminId) {
      return next();
    }

    // If this is an AJAX / API request, return 401 JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({ success: false, message: 'Not authenticated as admin' });
    }

    // Otherwise redirect to admin login page
    return res.redirect('/admin/login');
  } catch (err) {
    console.error('adminAuth error:', err);
    return res.redirect('/admin/login');
  }
};
