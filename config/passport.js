import dotenv from 'dotenv';
dotenv.config(); 

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/userSchema.js';

const getCallbackURL = () => {
    const url = process.env.NODE_ENV === 'production'
        ? process.env.GOOGLE_CALLBACK_URL_PROD
        : (process.env.GOOGLE_CALLBACK_URL_DEV || "http://localhost:3000/auth/google/callback");

    console.log("🚀 Google callback URL being used:", url);
    return url;
};


if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("❌ CRITICAL: Google OAuth environment variables are missing!");
    console.error("   Make sure your .env file has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
   
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        console.log("📧 Google Profile Email:", profile.emails?.[0]?.value);
        console.log("🆔 Google ID:", profile.id);

    
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            user.lastLogin = new Date();
            user.googleProfile = profile._json;

            if (profile.photos && profile.photos[0]) {
                user.profilePicture = profile.photos[0].value;
            }

            await user.save();
            return done(null, user);
        }

        
        const email = profile.emails?.[0]?.value;
        if (email) {
            user = await User.findOne({ email: email.toLowerCase() });

            if (user) {
                
                user.googleId = profile.id;
                user.googleProfile = profile._json;
                user.isVerified = true;
                user.verifiedAt = new Date();
                user.lastLogin = new Date();

                if (profile.photos && profile.photos[0]) {
                    user.profilePicture = profile.photos[0].value;
                }

                if (!user.fullName || user.fullName.trim() === '') {
                    user.fullName = profile.displayName;
                }

                await user.save();
                return done(null, user);
            }
        }


        const newUser = new User({
            googleId: profile.id,
            email: email ? email.toLowerCase() : null,
            fullName: profile.displayName,
            profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            googleProfile: profile._json,
            isVerified: true,
            verifiedAt: new Date(),
            lastLogin: new Date()
        });

        await newUser.save();
        console.log(" New Google user created:", newUser.email);
        return done(null, newUser);

    } catch (error) {
        console.error(' Google authentication error:', error);
        return done(error, null);
    }
}));

export default passport;