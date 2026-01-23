import Coupon from "../models/Coupon.js";
import Order from '../models/Order.js';
import User from '../models/userSchema.js';


export const loadCoupon = async (req, res) => {
  try {
    const userId = req.user?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "all";


    const now = new Date();
    const query = {
   
      // startDate: { $lte: now },
      // endDate: { $gte: now }
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }
    if(status=== "active"){
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };

    }
    if(status === "inactive"){
      query.isActive = false;
      
    }
    if(status === "expired"){
      query.endDate = {$lt:now}
    }
    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await Coupon.find(query)

      .select("code name description discountValue minPurchaseAmount")
      .skip(skip)
      .limit(limit)
      .lean()


    res.render("user/pages/coupons", {
      coupons,
      currentPage: page,
      totalPages,
      search,
      status
    })


  } catch (err) {
    console.log(err)
  }
}
export const loadorders = async (req,res)=>{


  try{

    let query ={
      orderStatus:"Delivered",
      finalAmount:{
        $gte:2000,
        $lte:3000
      }
    };
   

    const order = await Order.find(query)
    
    .select(" ")
    .populate({
      path: "user",
      select: " fullName email phone"
    })
      res.render("user/pages/cc",{
        order
      })


  }
  catch(err){
console.log(err)
  }
}