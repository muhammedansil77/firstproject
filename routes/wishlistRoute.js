
import express from 'express';
import { 
  getWishlistPage, 
  addToWishlist, 
  removeFromWishlist,
  moveToCart,
  
  
} from '../controllers/wishlistController.js';


const router = express.Router();


router.get('/wishlist', getWishlistPage);


router.post('/api/wishlist/add', addToWishlist);
router.delete('/api/wishlist/remove/:itemId', removeFromWishlist);
router.post('/api/wishlist/move-to-cart', moveToCart);

export default router;