import express from 'express';

import { getSalesReportPage, getDashboardData } from '../../controllers/admin/salesReportController.js';

const router = express.Router();

// Sales Reports
router.get('/reports/sales', getSalesReportPage);

// Dashboard data (AJAX)
router.get('/reports/dashboard-data', getDashboardData);

export default router;