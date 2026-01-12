export const setAuthLocals = (req, res, next) => {
  res.locals.isUserLoggedIn = Boolean(req.session?.isLoggedIn);
  res.locals.isAdminLoggedIn = Boolean(req.session?.adminLoggedIn);

  res.locals.user = req.session?.isLoggedIn ? req.user : null;
  res.locals.admin = req.session?.adminLoggedIn ? req.session.adminName : null;

  next();
};
