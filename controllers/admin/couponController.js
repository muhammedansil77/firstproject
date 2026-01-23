import Coupon from '../../models/Coupon.js';


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
     
        const today = new Date();
        
        const initialStats = {
            totalCoupons: await Coupon.countDocuments({ isDeleted: false }),
            activeCoupons: await Coupon.countDocuments({ 
                isActive: true, 
                isDeleted: false,
                startDate: { $lte: today },
                endDate: { $gte: today }
            }),
            expiredCoupons: await Coupon.countDocuments({ 
                isDeleted: false,
                endDate: { $lt: today }
            }),
            expiringSoon: await Coupon.countDocuments({
                isDeleted: false,
                isActive: true,
                endDate: { 
                    $gte: today,
                    $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                }
            })
        };
        
        res.render('admin/coupons', {
            title: 'Coupon Management',
            user: req.session.user,
            initialStats: initialStats,
            success: req.flash('success'),
            error: req.flash('error'),
            pageJS: 'coupon.js',
             cssFile: '/admin/css/coupon.css'
        });
    } catch (error) {
        console.error('Error rendering coupon page:', error);
        res.status(500).render('admin/error', {
            title: 'Error',
            message: 'Failed to load coupon management page'
        });
    }
};


export const getAllCoupons = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;
        
        const query = { isDeleted: false };
        
      
        if (status === 'active') {
            query.isActive = true;
            query.startDate = { $lte: new Date() };
            query.endDate = { $gte: new Date() };
        } else if (status === 'inactive') {
            query.isActive = false;
        } else if (status === 'expired') {
            query.endDate = { $lt: new Date() };
        } else if (status === 'upcoming') {
            query.startDate = { $gt: new Date() };
        }
        
  
        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
     
        const skip = (page - 1) * limit;
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        const coupons = await Coupon.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Coupon.countDocuments(query);
        
        res.json({
            success: true,
            data: coupons,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
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
        const {
            name,
            code,
            description,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            startDate,
            endDate,
            usageLimit,
            perUserLimit,
            isActive = true,
            couponType = 'single',
            bulkCount = 1,
            bulkPrefix = ''
        } = req.body;
        console.log("RAW BODY:", req.body);
console.log("usageLimit:", req.body.usageLimit, typeof req.body.usageLimit);
console.log("perUserLimit:", req.body.perUserLimit, typeof req.body.perUserLimit);

     
const parsedUsageLimit =
  usageLimit === '' || usageLimit === undefined
    ? 0
    : Number(usageLimit);

const parsedPerUserLimit =
  perUserLimit === '' || perUserLimit === undefined
    ? 1
    : Number(perUserLimit);

    // ===== BACKEND COUPON VALIDATION =====
const parsedDiscountValue = Number(discountValue);
const parsedMinPurchase = Number(minPurchaseAmount) || 0;
const parsedMaxDiscount = maxDiscountAmount ? Number(maxDiscountAmount) : null;

if (parsedMinPurchase < 0) {
    return res.status(400).json({
        success: false,
        error: 'Minimum purchase amount cannot be negative'
    });
}

if (discountType === 'percentage') {
    if (parsedDiscountValue <= 0 || parsedDiscountValue > 100) {
        return res.status(400).json({
            success: false,
            error: 'Percentage discount must be between 1 and 100'
        });
    }

    if (parsedMaxDiscount !== null && parsedMaxDiscount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Max discount amount must be greater than 0'
        });
    }
}

if (discountType === 'fixed') {
    if (parsedDiscountValue <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Fixed discount amount must be greater than 0'
        });
    }

    if (parsedMinPurchase > 0 && parsedDiscountValue > parsedMinPurchase) {
        return res.status(400).json({
            success: false,
            error: 'Fixed discount cannot be greater than minimum purchase amount'
        });
    }
}


        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                success: false,
                error: 'End date must be after start date'
            });
        }
        
        let couponCode = code;
        let coupons = [];
        
        if (couponType === 'bulk' && bulkCount > 1) {
          
            const generatedCoupons = [];
            for (let i = 0; i < bulkCount; i++) {
                const uniqueCode = bulkPrefix ? 
                    `${bulkPrefix}-${generateCouponCode()}` : 
                    generateCouponCode();
                const coupon = new Coupon({
                    code: uniqueCode,
                    name: `${name} #${i + 1}`,
                    description,
                    discountType,
                    discountValue,
                    minPurchaseAmount: minPurchaseAmount || 0,
                    maxDiscountAmount: maxDiscountAmount || null,
                    startDate,
                    endDate,
                   usageLimit: parsedUsageLimit,
perUserLimit: parsedPerUserLimit,

                    isActive
                });
                generatedCoupons.push(coupon);
            }
            
          
            await Coupon.insertMany(generatedCoupons);
            
            return res.status(201).json({
                success: true,
                message: `Successfully created ${bulkCount} coupons!`,
                data: generatedCoupons
            });
            
        } else {
           
            if (!couponCode) {
                couponCode = generateCouponCode();
            }
            
          
            const existingCoupon = await Coupon.findOne({ 
                code: couponCode.toUpperCase(),
                isDeleted: false 
            });
            
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    error: 'Coupon code already exists'
                });
            }
            
            const coupon = new Coupon({
                code: couponCode,
                name,
                description,
                discountType,
                discountValue,
                minPurchaseAmount: minPurchaseAmount || 0,
                maxDiscountAmount: maxDiscountAmount || null,
                startDate,
                endDate,
                usageLimit: parsedUsageLimit,
perUserLimit: parsedPerUserLimit,

                isActive
            });
            
            await coupon.save();
            
            return res.status(201).json({
                success: true,
                message: 'Coupon created successfully!',
                data: coupon
            });
        }
        
    } catch (error) {
        console.error('Error creating coupon:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create coupon'
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

