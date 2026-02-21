import Coupon from '../../models/Coupon.js';
import { getCouponStatsService,
    getAllCouponsService ,
    createCouponService 
 } from "../../services/couponService.js";


const generateCouponCode = (prefix = '') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const timestamp = Date.now().toString(36).toUpperCase();
    let random = '';
    
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return prefix ? `${prefix}-${random}-${timestamp.slice(-4)}` : `${random}-${timestamp.slice(-4)}`;
};


export const renderCouponPage = async (req, res) => {
  try {
    const initialStats = await getCouponStatsService();

    return res.render("admin/coupons", {
      title: "Coupon Management",
      user: req.session.user,
      initialStats,
      success: req.flash("success"),
      error: req.flash("error"),
      pageJS: "coupon.js",
      cssFile: "/admin/css/coupon.css"
    });

  } catch (error) {
    console.error("Error rendering coupon page:", error);

    return res.status(500).render("admin/error", {
      title: "Error",
      message: "Failed to load coupon management page"
    });
  }
};

export const getAllCoupons = async (req, res) => {
  try {
    const result = await getAllCouponsService(req.query);

    return res.json({
      success: true,
      data: result.coupons,
      pagination: result.pagination
    });

  } catch (error) {
    console.error("getAllCoupons error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


export const getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
            
        if (!coupon || coupon.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
        res.json({
            success: true,
            data: coupon
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const createCoupon = async (req, res) => {
  try {
    const result = await createCouponService(req.body);

    if (result.type === "bulk") {
      return res.status(201).json({
        success: true,
        message: `Successfully created ${result.count} coupons!`,
        data: result.coupons
      });
    }

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully!",
      data: result.coupons
    });

  } catch (error) {
    console.error("Error creating coupon:", error);

    return res.status(400).json({
      success: false,
      error: error.message || "Failed to create coupon"
    });
  }
};

export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
      
        const coupon = await Coupon.findById(id);
        if (!coupon || coupon.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
       
        if (updateData.code && updateData.code !== coupon.code) {
            const existingCoupon = await Coupon.findOne({ 
                code: updateData.code.toUpperCase(),
                _id: { $ne: id },
                isDeleted: false
            });
            
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    error: 'Coupon code already exists'
                });
            }
        }
        
      
        Object.assign(coupon, updateData);
        coupon.updatedAt = Date.now();
        
        await coupon.save();
        
        return res.json({
            success: true,
            message: 'Coupon updated successfully!',
            data: coupon
        });
        
    } catch (error) {
        console.error('Error updating coupon:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update coupon'
        });
    }
};


export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        
        const coupon = await Coupon.findById(id);
        if (!coupon || coupon.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
      
        if (coupon.usedCount > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete coupon that has been used'
            });
        }
        
     
        coupon.isDeleted = true;
        coupon.isActive = false;
        coupon.updatedAt = Date.now();
        await coupon.save();
        
        return res.json({
            success: true,
            message: 'Coupon deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting coupon:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete coupon'
        });
    }
};


export const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const coupon = await Coupon.findById(id);
        if (!coupon || coupon.isDeleted) {
            return res.status(404).json({
                success: false,
                error: 'Coupon not found'
            });
        }
        
        coupon.isActive = !coupon.isActive;
        coupon.updatedAt = Date.now();
        await coupon.save();
        
        return res.json({
            success: true,
            message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
            data: coupon
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getCouponStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        
   
        const totalCoupons = await Coupon.countDocuments({ isDeleted: false });
        
      
        const activeCoupons = await Coupon.countDocuments({ 
            isActive: true, 
            isDeleted: false,
            startDate: { $lte: today },
            endDate: { $gte: today }
        });
        
     
        const expiredCoupons = await Coupon.countDocuments({ 
            isDeleted: false,
            endDate: { $lt: today }
        });
        
      
        const monthlyCoupons = await Coupon.countDocuments({
            isDeleted: false,
            createdAt: { $gte: startOfMonth }
        });
    
        const yearlyCoupons = await Coupon.countDocuments({
            isDeleted: false,
            createdAt: { $gte: startOfYear }
        });
        
       
        const mostUsedCoupons = await Coupon.find({ isDeleted: false })
            .sort({ usedCount: -1 })
            .limit(5)
            .select('code name usedCount discountValue');
        
     
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const expiringSoon = await Coupon.countDocuments({
            isDeleted: false,
            isActive: true,
            endDate: { 
                $gte: today,
                $lte: nextWeek
            }
        });
        
        return res.json({
            success: true,
            data: {
                totalCoupons,
                activeCoupons,
                expiredCoupons,
                monthlyCoupons,
                yearlyCoupons,
                expiringSoon,
                mostUsedCoupons
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


export const validateCoupon = async (req, res) => {
    try {
        const { code, userId, totalAmount } = req.body;
        
        if (!code || !totalAmount) {
            return res.status(400).json({
                success: false,
                error: 'Code and total amount are required'
            });
        }
        
        const validation = await Coupon.validateCoupon(code, userId, totalAmount);
        
        if (validation.isValid) {
            return res.json({
                success: true,
                data: {
                    coupon: validation.coupon,
                    discount: validation.coupon.applyCoupon(totalAmount, userId).discount,
                    finalAmount: validation.coupon.applyCoupon(totalAmount, userId).finalAmount,
                    message: validation.message
                }
            });
        } else {
            return res.json({
                success: false,
                error: validation.message
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


export const exportCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .select('-__v -usersUsed -isDeleted');
        
       
        const headers = ['Code', 'Name', 'Discount', 'Start Date', 'End Date', 'Usage Limit', 'Used Count', 'Status'];
        const csvRows = [];
        
        csvRows.push(headers.join(','));
        
        coupons.forEach(coupon => {
            const row = [
                coupon.code,
                `"${coupon.name}"`,
                coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`,
                new Date(coupon.startDate).toISOString().split('T')[0],
                new Date(coupon.endDate).toISOString().split('T')[0],
                coupon.usageLimit || 'Unlimited',
                coupon.usedCount,
                coupon.isActive ? 'Active' : 'Inactive'
            ];
            
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=coupons.csv');
        res.send(csvContent);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

