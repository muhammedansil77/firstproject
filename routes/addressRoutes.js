import express from "express";
import {
  loadAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  showUploadPage,
  uploadImage,
  setDefaultAddress
} from "../controllers/addressController.js";
import { upload } from "../middlewares/upload.js";
import authMiddle from "../middlewares/user/authMiddleware.js";


const router = express.Router();

router.use(authMiddle.preventCacheForAuth);
router.use(authMiddle.attachUser);
router.use(authMiddle.preventBackToAuth);
router.use(authMiddle.protectRoute);

router.get("/", loadAddresses);
router.post("/add", addAddress);
router.post("/edit/:id", editAddress);
router.post("/delete/:id", deleteAddress);
router.get("/upload-image", showUploadPage);
router.post("/set-default/:id", setDefaultAddress);

router.post("/upload-image", upload.single("image"), uploadImage);



export default router;
