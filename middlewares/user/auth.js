// middleware/auth.js
export const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // For API endpoints, return JSON error
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized. Please login first.' 
    });
  }
  
  // For regular pages, redirect to login
  res.redirect('/login');
};