export const hardBlock = async (req, res, next) => {
  try {
  
    if (req.originalUrl.startsWith('/admin')) {
      return next();
    }

  
    if (!req.session?.userId) {
      return next();
    }

    if (!req.user) {
      return next();
    }

  
    if (req.user.isBlocked) {
      
      req.session.userId = null;
      req.session.isLoggedIn = false;

     
      if (
        req.xhr ||
        req.headers.accept?.includes('application/json')
      ) {
        return res.status(403).json({
          success: false,
          message: 'Account blocked'
        });
      }

   
      return res.status(404).render('user/pages/page-404', {
        layout: false
      });
    }

    next();
  } catch (err) {
    console.error('hardBlock error:', err);
    next();
  }
};
