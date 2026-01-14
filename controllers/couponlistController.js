import Coupon from "../models/Coupon.js";


export const loadCoupon = async (req,res)=>{
    try{
         const userId = req.user?._id;
        const{
            page=1,
            limit=10,
            status,
            search,
            sort = "newest"
        } = req.query;

        const now = new Date();
        const query ={
         isActive: true,
      isDeleted: false,
      startDate: { $lte: now },
      endDate: { $gte: now }
        }

        const coupons = await Coupon.find(query)
       
           .select("code name description discountValue minPurchaseAmount")

            .lean()
  res.render("user/pages/coupons",{
    coupons
  })
      
       
    }catch(err){
 console.log(err)
    }
}