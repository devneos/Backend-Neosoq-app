const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const adminController = require('../../controllers/admin/promotionController');

// All admin routes are protected
router.use(verifyJWT, isAdmin);

router.post('/', adminController.createPlan);
router.get('/', adminController.listPlans);
router.put('/:id', adminController.updatePlan);

// Purchases
router.get('/purchases', adminController.listPurchases);
router.get('/purchases/:id', adminController.getPurchase);

module.exports = router;

