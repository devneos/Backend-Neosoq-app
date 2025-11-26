const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const { revenueTrend, monthlyTransactions, topPerformers, dashboardCards } = require('../../controllers/admin/analyticsController');

router.get('/revenue-trend', verifyJWT, isAdmin, revenueTrend);
router.get('/monthly-transactions', verifyJWT, isAdmin, monthlyTransactions);
router.get('/top-performers', verifyJWT, isAdmin, topPerformers);
router.get('/dashboard-cards', verifyJWT, isAdmin, dashboardCards);

module.exports = router;
