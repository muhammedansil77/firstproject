import express from 'express';

import { getSalesReportPage, getDashboardData } from '../../controllers/admin/salesReportController.js';

const router = express.Router();


router.get('/reports/sales', getSalesReportPage);


router.get('/reports/dashboard-data', getDashboardData);

export default router;