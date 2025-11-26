const express = require('express');
const router = express.Router();
const { getSummary, listTransactions } = require('../../controllers/admin/dashboardController');
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');

// GET /admin/dashboard/summary
router.get('/summary', verifyJWT, isAdmin, getSummary);

// GET /admin/dashboard/transactions
router.get('/transactions', verifyJWT, isAdmin, listTransactions);

module.exports = router;
