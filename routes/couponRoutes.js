import express from "express"
const router = express.Router()

import {loadCoupon}  from "../controllers/couponlistController.js"



router.get("/coupon",loadCoupon);



export default router
