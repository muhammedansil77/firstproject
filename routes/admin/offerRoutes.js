import express from 'express';
import offerController from '../../controllers/admin/offerController.js';

const router = express.Router();

// Main offers page
router.get('/offers', offerController.renderOffersPage);

// AJAX endpoints for modal
router.get('/offers/:id/json', offerController.getOfferJson);
router.get('/offers/ajax/products', offerController.getProductsAjax);
router.get('/offers/ajax/categories', offerController.getCategoriesAjax);


// CRUD operations (modal-based)
router.post('/offers/create', offerController.createOffer);
router.post('/offers/:id/edit', offerController.updateOffer);
router.post('/offers/:id/toggle-status', offerController.toggleOfferStatus);
router.post('/offers/:id/delete', offerController.deleteOffer);

export default router;