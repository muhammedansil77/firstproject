import express from 'express';
import { attachUser } from "../middlewares/user/authMiddleware.js";
import { hardBlock } from "../middlewares/user/hardBlock.js";
import { loadCategories } from "../middlewares/user/loadCategries.js";
import { setAuthLocals } from "../middlewares/user/setAuthLocals.js";
import adminAuth from "../middlewares/user/adminAuth.js";

// Import all routers
import userRouter from "./userRouter.js";
import adminRouter from "./admin/adminRouter.js";
import addressRoutes from "./addressRoutes.js";
import profileRouter from "./profileRoutes.js";
import checkourPage from "./checkoutroutes.js";
import orderRoutes from "./admin/orderRoutes.js";
import Return from "./admin/returnRouter.js";
import authRoutes from "./auth.js";

const router = express.Router();

/**
 * Configure all application routes
 * @param {express.Application} app - Express app instance
 */
export const configureRoutes = (app) => {

  app.use(setAuthLocals);
  
 
  const userMiddlewares = [attachUser, hardBlock, loadCategories];
  
  app.use("/user", ...userMiddlewares, userRouter);
  app.use("/user/address", ...userMiddlewares, addressRoutes);
  app.use("/user/profile", ...userMiddlewares, profileRouter);
  

  app.use("/checkout", ...userMiddlewares, checkourPage);
  

  app.use("/admin", 
    (req, res, next) => {
      res.locals.layout = "admin/layouts/main";
      res.locals.isAdmin = true;
      next();
    },
    adminAuth,
    adminRouter
  );
  
 
  app.use("/admin/orders", orderRoutes);
  app.use("/admin/returns", Return);
  
 
  app.use("/auth", authRoutes);
  

  app.get("/", (req, res) => {
    if (req.session?.adminLoggedIn) {
      return res.redirect('/admin/dashboard');
    }
    if (req.session?.isLoggedIn) {
      return res.redirect('/user');
    }
    res.redirect('/user/login');
  });
};

export default router;