import express from 'express';

import { getSalesReportPage, getDashboardData } from '../../controllers/admin/dasbordController.js';

const router = express.Router();


router.get('/reports/dash', getSalesReportPage);


router.get('/reports/dashboard', getDashboardData);

export default router;