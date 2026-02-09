
import { attachUser } from "../middlewares/user/authMiddleware.js";
import { hardBlock } from "../middlewares/user/hardBlock.js";
import  loadCategories from "../middlewares/user/loadCategries.js";
import { setAuthLocals } from "../middlewares/user/setAuthLocals.js";
import adminAuthPkg from "../middlewares/user/adminAuth.js";
import adminAuth from "../middlewares/user/adminAuth.js";
import { setHeaderCounts } from "../middlewares/user/setHeaderCounds.js";


import { protectRoute } from "../middlewares/user/authMiddleware.js";


import userRouter from "../routes/userRouter.js";
import adminRouter from "../routes/admin/adminRouter.js";

import addressRoutes from "../routes/addressRoutes.js";
import profileRouter from "../routes/profileRoutes.js";
import checkourPage from "../routes/checkoutroutes.js";
import orderRoutes from '../routes/admin/orderRoutes.js';
import Return from "../routes/admin/returnRouter.js";
import authRoutes from '../routes/auth.js';
import walletRoute from "../routes/walletRoutes.js"
import refferalRoutes from "../routes/referralRoutes.js"
import offerRoutes from "../routes/admin/offerRoutes.js"
import couponRoutes from "../routes/admin/couponRoutes.js"
import salesRoutes from "../routes/admin/salesReportRoutes.js"
import wishlistRoutes from "../routes/wishlistRoute.js"
import dashboardRoutes from "../routes/admin/dashbordRoutes.js"
import couprnn from "../routes/couponRoutes.js"


/**
 * Configure all application routes
 * @param {express.Application} app 
 */
export const configureRoutes = (app) => {


  app.use(setAuthLocals);

 const publicUserMiddlewares = [
  attachUser,
  loadCategories,
  setHeaderCounts
];

const protectedUserMiddlewares = [
  attachUser,
  hardBlock,
  loadCategories,
  setHeaderCounts
 
];




  app.use("/auth", authRoutes);

  app.use("/user", ...publicUserMiddlewares, userRouter);

  app.use("/user/address", ...publicUserMiddlewares, addressRoutes);
  app.use("/user", ...publicUserMiddlewares, profileRouter);
  app.use("/",setHeaderCounts, checkourPage);
  app.use("/user", ...protectedUserMiddlewares, walletRoute);
  app.use("/user",protectedUserMiddlewares, refferalRoutes)
  app.use("/user",protectedUserMiddlewares, wishlistRoutes)
  app.use("/user",protectedUserMiddlewares,couprnn)


  app.use(
    "/admin",
    (req, res, next) => {
      res.locals.layout = "admin/layouts/main";
      res.locals.isAdmin = true;
      next();
    },
    adminAuth,
    adminRouter,
    orderRoutes,
    Return,
    offerRoutes,
    couponRoutes,
    salesRoutes,
    dashboardRoutes
  );






  app.get("/", (req, res) => {
    if (req.session?.adminLoggedIn) {
      return res.redirect("/admin/reports/dash");
    }
    if (req.session?.isLoggedIn) {
      return res.redirect("/user");
    }
    res.redirect("/user/");
  });




  app.use("/user", (req, res) => {
    return res.status(404).render("error/404", {
      isLoggedIn: req.session?.isLoggedIn || false,
      isAdmin: false,
      layout: false
    });
  });


  app.use("/admin", (req, res) => {
    res.status(404).render("error/admin-404", {
      layout: false
    });
  });
  app.use((err, req, res, next) => {
    console.error("🔥 GLOBAL ERROR:", err);

    if (res.headersSent) {
      return next(err);
    }

    // API request → JSON
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again later."
      });
    }

    // Page request → Render error page
    res.status(500).render("error/500", {
      isLoggedIn: req.session?.isLoggedIn || false,
      isAdmin: req.session?.adminLoggedIn || false,
      layout: false
    });
  });




};


export default { configureRoutes };