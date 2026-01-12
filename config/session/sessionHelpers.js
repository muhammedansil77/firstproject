import dotenv from "dotenv";
dotenv.config();


export const sessionHelpers = {

  initUserSession: (req, user) => {
    req.session.isLoggedIn = true;
    req.session.userId = user._id;
    req.session.userEmail = user.email;
    req.session.userName = user.name || user.username;
    req.session.cartId = user.cart || null;
 
    if (user.role) {
      req.session.userRole = user.role;
    }
    
  
    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return req.session;
  },


  initAdminSession: (req, admin) => {
    req.session.adminLoggedIn = true;
    req.session.adminId = admin._id;
    req.session.adminEmail = admin.email;
    req.session.adminName = admin.name || admin.username;
    
 
    if (admin.role) {
      req.session.adminRole = admin.role;
    }
    
 
    req.session.cookie.maxAge = 8 * 60 * 60 * 1000; // 8 hours
    
    return req.session;
  },


  destroySession: (req, res) => {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
        } else {
          res.clearCookie('appSession');
          resolve();
        }
      });
    });
  },


  isUserAuthenticated: (req) => {
    return req.session && req.session.isLoggedIn === true;
  },

 
  isAdminAuthenticated: (req) => {
    return req.session && req.session.adminLoggedIn === true;
  },

 
  getUserId: (req) => {
    return req.session?.userId || null;
  },


  getAdminId: (req) => {
    return req.session?.adminId || null;
  },

 
  regenerateSession: (req) => {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

 
  saveSession: (req) => {
    return new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },


  setCacheControl: (req, res, next) => {
    const noCachePaths = [
      '/user/login',
      '/user/signup',
      '/user/verify-otp',
      '/user/forgot-password',
      '/user/forget-verify-otp',
      '/user/reset-password',
      '/user/logout',
      '/admin/login',
      '/admin/logout'
    ];
    
    const isAuthPath = noCachePaths.some(p => req.path.startsWith(p));
    const hasUserSession = req.session && req.session.isLoggedIn;
    const hasAdminSession = req.session && req.session.adminLoggedIn;
    
    if (hasUserSession || hasAdminSession || isAuthPath) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    } else {
      res.set('Cache-Control', 'public, max-age=300');
    }
    next();
  },

 
  clearAllSessions: async (req) => {
    try {
      await req.sessionStore.clear();
      return { success: true, message: 'All sessions cleared' };
    } catch (err) {
      throw new Error(`Failed to clear sessions: ${err.message}`);
    }
  },


  getSessionDebugInfo: (req) => {
    return {
      sessionID: req.sessionID,
      session: {
        adminLoggedIn: req.session?.adminLoggedIn,
        isLoggedIn: req.session?.isLoggedIn,
        adminId: req.session?.adminId,
        userId: req.session?.userId,
        userEmail: req.session?.userEmail,
        adminEmail: req.session?.adminEmail
      },
      cookies: req.cookies || {},
      user: req.user || null
    };
  }
};