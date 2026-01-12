import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
dotenv.config();


export const createSessionConfig = () => {
  const sessionConfig = {
    name: 'appSession',
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce_db',
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, 
      autoRemove: 'native',
      touchAfter: 24 * 3600, 
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
      path: '/',
      httpOnly: true,
    }
  };


  if (process.env.NODE_ENV !== 'production') {
    sessionConfig.cookie.secure = false;
    sessionConfig.cookie.sameSite = 'lax';
  }

  return sessionConfig;
};


export const initSession = (app) => {
  const sessionConfig = createSessionConfig();
  app.use(session(sessionConfig));
  

  app.use((req, res, next) => {
    console.log('=== SESSION INITIALIZED ===');
    console.log('Session ID:', req.sessionID);
    console.log('Session Store:', req.sessionStore?.constructor?.name || 'MemoryStore');
    console.log('Session Cookie:', req.session.cookie);
    console.log('===========================');
    next();
  });

  return sessionConfig;
};


export const getSessionConfig = () => {
  return createSessionConfig();
};