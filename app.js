require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const expressLayout = require("express-ejs-layouts");
const passport = require('./config/passport'); 

// your app-specific middleware / routers
const { preventBlocked }  = require("./middlewares/user/preventBlocked");
const attachUser1 = require("./middlewares/user/authMiddleware");
const loadCategories1 = require("./middlewares/user/loadCategries");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/admin/adminRouter");
const db = require("./config/db");
const authRoutes = require('./routes/auth');

const app = express();
db();

const PORT = process.env.PORT || 5000;

/**
 * Static files early — serve CSS/JS/images without hitting session middleware.
 * This helps prevent unnecessary session cookie creation for static requests.
 */
app.use(express.static(path.join(__dirname, "public")));

/**
 * Cookie parser so req.cookies is available
 */
app.use(cookieParser());

/**
 * Body parsers
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Session config
 * - saveUninitialized: false prevents creating session cookies for every request
 * - resave: false is fine for most setups
 * 
 * 
 */

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));
app.use(session({
  name: 'userSession',
  secret: process.env.USER_SESSION_SECRET || 'user_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    path: '/user' // IMPORTANT: Only sent for /user paths
  }
}));
app.use('/admin', session({
  name: 'adminSession',
  secret: process.env.ADMIN_SESSION_SECRET || 'admin_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 hours for admin
    path: '/admin' // IMPORTANT: Only sent for /admin paths
  }
}));
app.use(passport.initialize());
app.use(passport.session());
/**
 * Simple request logger (helpful while debugging)
 */
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} cookies=${JSON.stringify(req.cookies || {})}`);
  next();
});

/**
 * Middlewares that depend on the session must come AFTER session()
 */
app.use(attachUser1.attachUser);
app.use(preventBlocked);
app.use(loadCategories1);

/**
 * Cache rules (keep, but simple)
 */
app.use((req, res, next) => {
  const noCachePaths = [
    '/user/login',
    '/user/signup',
    '/user/verify-otp',
    '/user/forgot-password',
    '/user/forget-verify-otp',
    '/user/reset-password',
    '/user/logout'
  ];
  const isAuthPath = noCachePaths.some(p => req.path.startsWith(p));
  if (req.session && req.session.isLoggedIn) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  } else if (isAuthPath) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  } else {
    res.set('Cache-Control', 'public, max-age=300');
  }
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

/**
 * EJS Layouts + View Engine
 */
app.use(expressLayout);
app.set("layout", "user/layouts/main");
app.set("layout extractScripts", true);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set('view cache', false); // disable view cache in dev

/**
 * USER & ADMIN routes
 */
app.use("/user", userRouter);

app.use("/admin", (req, res, next) => {
  res.locals.layout = "admin/layouts/main";
  res.locals.isAdmin = true;
  next();
}, adminRouter);

app.use('/auth', authRoutes);

/**
 * Small debug route to inspect cookies and session
 * visit: GET /debug/session
 */
app.get('/debug/session', (req, res) => {
  res.json({
    cookies: req.cookies || {},
    session: (() => {
      // shallow copy so we don't reveal secret internals
      const s = Object.assign({}, req.session || {});
      return s;
    })()
  });
});

/**
 * Test route
 */
app.get("/oo", (req, res) => {
  res.render("user/pages/home");
});

/**
 * 404
 */
app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

console.log("All routes:", require('express').Router().stack);

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
