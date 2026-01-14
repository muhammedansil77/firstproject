import express from 'express';
import { upload } from '../middlewares/upload.js';
import { uploadImagePage, uploadImagePost } from '../controllers/addressImage.controller.js';

const router = express.Router();

router.get('/upload-image', uploadImagePage);
router.post(
  '/upload-image',
  upload.single('image'),
  uploadImagePost
);

export default router;
