import express from 'express';
import { attachUser } from "../../middlewares/user/authMiddleware.js";
import { hardBlock } from "../../middlewares/user/hardBlock.js";
import pkg from "../middlewares/user/loadCategries.js";
const { loadCategories } = pkg;

// Import user-related routers
import userMainRouter from "../userRouter.js";
import addressRouter from "../addressRoutes.js";
import profileRouter from "../profileRoutes.js";
import checkoutRouter from "../checkoutroutes.js";

const router = express.Router();

// Common middlewares for all user routes
const userMiddlewares = [attachUser, hardBlock, loadCategories];

// Apply middlewares to all routes
router.use(userMiddlewares);

// Mount user routers
router.use("/", userMainRouter);          // /user/*
router.use("/address", addressRouter);    // /user/address/*
router.use("/profile", profileRouter);    // /user/profile/*

export default router;