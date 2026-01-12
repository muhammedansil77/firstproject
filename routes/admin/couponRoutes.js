import express from 'express';
import {
    renderCouponPage,
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    getCouponStats,
    validateCoupon,
    exportCoupons
} from '../../controllers/admin/couponController.js';

const router = express.Router();




router.get('/coupons', renderCouponPage);


router.get('/api/coupons', getAllCoupons);
router.get('/api/coupons/stats', getCouponStats);
router.get('/api/coupons/:id', getCouponById);


router.post('/api/coupons', createCoupon);
router.put('/api/coupons/:id', updateCoupon);
router.delete('/api/coupons/:id', deleteCoupon);
router.patch('/api/coupons/:id/toggle-status', toggleCouponStatus);


router.get('/coupons/export/csv', exportCoupons);
router.post('/api/coupons/validate', validateCoupon);

export default router;