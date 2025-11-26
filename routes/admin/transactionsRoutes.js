const express = require('express');
const router = express.Router();
const { listTransactions, getTransactionDetails, getSummaryCards } = require('../../controllers/admin/transactionsController');
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');

router.use(verifyJWT, isAdmin);

router.get('/', listTransactions);
router.get('/summary', getSummaryCards);
router.get('/:id', getTransactionDetails);

module.exports = router;
