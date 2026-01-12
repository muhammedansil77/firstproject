import express from 'express';
import { 
  loadAdminOrders, 
  updateOrderStatus, 
  getOrderDetails,
  clearFilters,
  viewOrderDetails,
  
} from '../../controllers/admin/orderController.js';

const router = express.Router();


router.get('/orders', loadAdminOrders);
router.get('/orders/clear-filters', clearFilters);
router.post('/orders/update-status/:orderId', updateOrderStatus); 
router.get('/orders/:orderId/details', getOrderDetails);          
router.get('/orders/:orderId', viewOrderDetails);  


export default router;