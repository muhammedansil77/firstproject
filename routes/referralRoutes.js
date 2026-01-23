
import express from 'express';

import * as referralController from '../controllers/referralController.js';

const router = express.Router();


router.get('/referrals', referralController.getReferralPage);
router.get('/api/referrals/stats', referralController.getReferralStats);
router.post('/api/referrals/copy-link', referralController.copyReferralLink);

export default router;