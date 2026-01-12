
import express from 'express';
import {
  getAllReturns,
  getReturnDetail,
  updateReturnStatusWithNotes,
  bulkUpdateReturns,
  deleteReturn,
  exportReturns,
  rejectReturn
} from '../../controllers/admin/returnController.js';

const router = express.Router();
router.get('/returns/export', exportReturns); 

router.get('/returns', getAllReturns);                   
router.get('/returns/:id', getReturnDetail);          
router.put('/returns/:id/status', updateReturnStatusWithNotes); 
router.put('/returns/bulk-update', bulkUpdateReturns);  
router.delete('/returns/:id', deleteReturn);             
router.get('/returns/export/csv', exportReturns);  

router.post('returns/:id/reject', rejectReturn);      

export default router;