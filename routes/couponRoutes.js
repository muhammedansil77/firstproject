import express from "express"
const router = express.Router()

import {loadCoupon,loadorders}  from "../controllers/couponlistController.js"



router.get("/coupon",loadCoupon);
// router.get("/cc",loadorders)



export default router
