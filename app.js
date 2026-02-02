import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import expressLayout from "express-ejs-layouts";
import passport from './config/passport.js';
import { fileURLToPath } from 'url';
import multer from 'multer';
import db from "./config/db.js";
import imageRoutes from "./routes/image.routes.js";
import flash from 'connect-flash';

import { initSession, sessionHelpers } from "./config/session/index.js";


import { configureRoutes } from "./config/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
app.use("/",imageRoutes)


app.use((req, res, next) => {
  console.log('=== REQUEST DEBUG ===');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'accept': req.headers['accept'],
    'user-agent': req.headers['user-agent']
  });
  console.log('=====================');
  next();
});

app.use((req, res, next) => {
  res.locals.query = req.query || {};
  next();
});

app.use((req, res, next) => {
  console.log('[REQ]', req.method, req.path, 
    'cookies=', Object.keys(req.cookies || {}).join(','), 
    'sessionID=', req.sessionID);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cookieParser());
initSession(app);

app.use(passport.initialize());



app.use(sessionHelpers.setCacheControl);

app.use(flash());
app.use(expressLayout);
app.set("layout", "user/layouts/main");
app.set("layout extractScripts", true);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set('view cache', false);


app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.user;
  next();
});


app.get("/favicon.ico", (req, res) => {
  const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
  res.status(204).end();
});
app.use((req, res, next) => {
  console.log(
    ' ROUTE TRACE →',
    req.method,
    req.originalUrl
  );
  next();
});



configureRoutes(app);


app.get('/debug/session', (req, res) => {
  res.json(sessionHelpers.getSessionDebugInfo(req));
});

app.get('/debug/clear-sessions', async (req, res) => {
  try {
    const result = await sessionHelpers.clearAllSessions(req);
    req.session.destroy();
    res.clearCookie('appSession');
    res.json({ success: true, message: 'All sessions cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    sessionStore: req.sessionStore?.constructor?.name || 'unknown',
    sessionEnabled: true,
    sessionCount: req.sessionStore?.store?.client ? 'MongoDB Connected' : 'Unknown'
  });
});


app.use((req, res) => {
  console.log(`404 Error: ${req.method} ${req.url}`);
  res.status(404).send('Not Found');
});




app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError || err.message.includes('image')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (req.originalUrl.startsWith('/user')) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

  res.status(500).render('404', {
    title: 'Server Error',
    layout: 'user/layouts/main'
  });
});

const startServer = async () => {
  try {
    await db(); // ⬅️ WAIT for MongoDB
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
};

startServer();
