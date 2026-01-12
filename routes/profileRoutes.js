import express from 'express';
import multer from 'multer';
import path from 'path';

import * as userProfileController from '../controllers/userProfileController.js';
import authMiddle from "../middlewares/user/authMiddleware.js";

const router = express.Router();
router.use(authMiddle.preventCacheForAuth);
router.use(authMiddle.attachUser);
router.use(authMiddle.preventBackToAuth);
router.use(authMiddle.protectRoute); 


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});





router.get('/profile', userProfileController.loadProfile);


router.post('/profile/update', userProfileController.updateProfile);


router.post(
  '/profile/upload-image',
  upload.single('profileImage'),  
  userProfileController.uploadProfileImage
);



router.post('/profile/email/initiate-change', userProfileController.initiateEmailChange);


router.post('/profile/email/verify-change', userProfileController.verifyEmailChange);


router.post('/profile/change-password', userProfileController.changePassword);


router.post('/profile/update-settings', userProfileController.updateAccountSettings);

export default router;