// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');

// simple logger to ensure route is hit
router.get('/google', (req, res, next) => {
  console.log('GET /auth/google requested');
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/user/login?error=Google Login Failed'
  }),
  (req, res) => {

    // Set the same session variables as normal login
    req.session.userId = req.user._id;
    req.session.isLoggedIn = true;
    req.session.fullName = req.user.fullName;

    req.session.save(() => {
      res.redirect('/user/home');
    });
  }
);

router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) console.error('logout error', err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

module.exports = router;
