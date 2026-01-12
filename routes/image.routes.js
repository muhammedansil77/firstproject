import express from "express";
import { upload } from "../middlewares/upload.js";
import { showUploadPage, uploadImage } from "../controllers/addressImage.controller.js";

const router = express.Router();

router.get("/upload-image", showUploadPage);
router.post("/upload-image", upload.single("image"), uploadImage);

export default router;
