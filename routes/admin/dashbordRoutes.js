import express from 'express';

import { getSalesReportPage, getDashboardData } from '../../controllers/admin/dasbordController.js';

const router = express.Router();

// Sales Reports
router.get('/reports/dash', getSalesReportPage);

// Dashboard data (AJAX)
router.get('/reports/dashboard', getDashboardData);

export default router;