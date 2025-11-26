const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const { listWalletTransactions, listWithdrawalRequests, paymentSummary } = require('../../controllers/admin/paymentController');

router.get('/wallet-transactions', verifyJWT, isAdmin, listWalletTransactions);
router.get('/withdrawal-requests', verifyJWT, isAdmin, listWithdrawalRequests);
router.get('/summary', verifyJWT, isAdmin, paymentSummary);

module.exports = router;
