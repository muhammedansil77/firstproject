import dotenv from 'dotenv';
dotenv.config(); 

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userSchema.js';

const getCallbackURL = () => {
    if (process.env.NODE_ENV === 'production') {
        return process.env.GOOGLE_CALLBACK_URL_PROD;
    }
    return process.env.GOOGLE_CALLBACK_URL_DEV;
};



if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("❌ CRITICAL: Google OAuth environment variables are missing!");
    console.error("   Make sure your .env file has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
   
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // 🔥 FORCE THE CALLBACK (NO ENV LOGIC)
      callbackURL: getCallbackURL(),

      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        const email = profile.emails?.[0]?.value;

        user = await User.findOne({ email });

        if (user) {
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }

        const newUser = await User.create({
          googleId: profile.id,
          email,
          fullName: profile.displayName,
          isVerified: true
        });

        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


export default passport;