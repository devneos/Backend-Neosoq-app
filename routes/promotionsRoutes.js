const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const verifyJWT = require('../middleware/verifyJWT');

// Public: list available promotion plans
router.get('/', promotionController.listPlans);
router.get('/:id', promotionController.getPlan);

// Purchase a promotion (requires auth)
router.post('/purchase', verifyJWT, promotionController.purchasePlan);

// Payment provider webhook for promotions (MyFatoorah)
router.post('/webhooks/myfatoorah', promotionController.myfatoorahWebhook);

module.exports = router;
