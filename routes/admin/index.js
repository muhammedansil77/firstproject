import express from 'express';
import adminAuth from "../../middlewares/user/adminAuth.js";


import adminMainRouter from "./adminRouter.js";
import orderRouter from "./orderRoutes.js";
import returnRouter from "./returnRouter.js";

const router = express.Router();


router.use((req, res, next) => {
  res.locals.layout = "admin/layouts/main";
  res.locals.isAdmin = true;
  next();
});


router.use(adminAuth);


router.use("/", adminMainRouter);     
router.use("/orders", orderRouter);   
router.use("/returns", returnRouter); 

export default router;