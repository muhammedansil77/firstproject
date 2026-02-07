import express from 'express';


import * as userProfileController from '../controllers/userProfileController.js';
import authMiddle from "../middlewares/user/authMiddleware.js";
import { upload } from "../middlewares/upload.js"; 

const router = express.Router();
router.use(authMiddle.preventCacheForAuth);
router.use(authMiddle.attachUser);
router.use(authMiddle.preventBackToAuth);
router.use(authMiddle.protectRoute); 









router.get('/profile', userProfileController.loadProfile);


router.post('/profile/update', userProfileController.updateProfile);


router.post(
  "/profile/upload-image",
  upload.single("profileImage"),
  userProfileController.uploadProfileImage
);



router.post('/profile/email/initiate-change', userProfileController.initiateEmailChange);


router.post('/profile/email/verify-change', userProfileController.verifyEmailChange);


router.post('/profile/change-password', userProfileController.changePassword);


router.post('/profile/update-settings', userProfileController.updateAccountSettings);
router.post("/profile/email/resend-otp", userProfileController.resendEmailOtp);


export default router;