const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const idempotency = require('../middleware/idempotency');
const { topup, tapWebhook, getWallet, withdraw } = require('../controllers/walletController');

router.post('/topup', verifyJWT, idempotency, topup);
router.post('/withdraw', verifyJWT, withdraw);
router.get('/', verifyJWT, getWallet);

// webhook should be unprotected endpoint called by Tap; we allow raw body
// webhook should be an unprotected endpoint called by payment providers; we allow raw body
router.post('/webhooks/myfatoorah', express.text({ type: '*/*' }), tapWebhook);

module.exports = router;
