import express from 'express';
import passport from 'passport';

const router = express.Router();


router.get('/google', (req, res, next) => {
  console.log('GET /auth/google requested');
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));


router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/user/login?error=Google Login Failed',
    session: false
  }),
  (req, res) => {
  
    req.session.userId = req.user._id;
    req.session.isLoggedIn = true;
    req.session.fullName = req.user.fullName;

    req.session.save(() => {
      res.redirect('/user');
    });
  }
);




router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) console.error('logout error', err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/user');
    });
  });
});

export default router;