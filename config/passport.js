const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});


passport.use(new GoogleStrategy({

    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,

   
    callbackURL: (() => {
        const url = process.env.NODE_ENV === 'production'
            ? process.env.GOOGLE_CALLBACK_URL_PROD
            : (process.env.GOOGLE_CALLBACK_URL_DEV || "http://localhost:3000/auth/google/callback");

        console.log("🚀 Google callback URL being used:", url);
        return url;
    })()

}, async (accessToken, refreshToken, profile, done) => {

    try {
      
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

       
        user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });

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

   
        const newUser = new User({
            googleId: profile.id,
            email: profile.emails[0].value.toLowerCase(),
            fullName: profile.displayName,
            profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            googleProfile: profile._json,
            isVerified: true,
            verifiedAt: new Date(),
            lastLogin: new Date()
        });

        await newUser.save();
        return done(null, newUser);

    } catch (error) {
        console.error('Google authentication error:', error);
        return done(error, null);
    }
}));

module.exports = passport;
