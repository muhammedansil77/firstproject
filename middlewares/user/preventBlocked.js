// middlewares/preventBlocked.js
module.exports.preventBlocked = (req, res, next) => {
  try {
    if (!req.user) return next();

    if (req.user.isBlocked) {
      // destroy session and redirect to login with a flag
      if (req.session) {
        req.session.destroy(err => {
          if (err) console.error("Session destroy error:", err);
          return res.redirect("/auth/login?blocked=1");
        });
      } else {
        return res.redirect("/auth/login?blocked=1");
      }
      return;
    }

    return next();
  } catch (err) {
    console.error("preventBlocked error:", err);
    return next();
  }
};
