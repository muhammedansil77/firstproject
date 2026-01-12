

export const SESSION_KEYS = {
  USER: {
    LOGGED_IN: 'isLoggedIn',
    USER_ID: 'userId',
    USER_EMAIL: 'userEmail',
    USER_NAME: 'userName',
    CART_ID: 'cartId',
    ROLE: 'userRole'
  },
  ADMIN: {
    LOGGED_IN: 'adminLoggedIn',
    ADMIN_ID: 'adminId',
    ADMIN_EMAIL: 'adminEmail',
    ADMIN_NAME: 'adminName',
    ROLE: 'adminRole'
  }
};

export const SESSION_TIMEOUTS = {
  USER: 24 * 60 * 60 * 1000, // 24 hours
  ADMIN: 8 * 60 * 60 * 1000, // 8 hours
  GUEST: 30 * 60 * 1000 
};

export const SESSION_PATHS = {
  NO_CACHE: [
    '/user/login',
    '/user/signup',
    '/user/verify-otp',
    '/user/forgot-password',
    '/user/forget-verify-otp',
    '/user/reset-password',
    '/user/logout',
    '/admin/login',
    '/admin/logout'
  ],
  USER_ONLY: ['/user', '/user/*'],
  ADMIN_ONLY: ['/admin', '/admin/*']
};

export const SESSION_ERRORS = {
  NOT_FOUND: 'Session not found',
  EXPIRED: 'Session expired',
  INVALID: 'Invalid session',
  DESTROY_FAILED: 'Failed to destroy session',
  SAVE_FAILED: 'Failed to save session'
};