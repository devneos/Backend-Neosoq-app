const express = require('express');
const router = express.Router();
const { createStaffInvite } = require('../controllers/adminController');
const verifyJWT = require('../middleware/verifyJWT');
const isAdmin = require('../middleware/isAdmin');

// POST /admin/staff/invite
router.post('/staff/invite', verifyJWT, isAdmin, createStaffInvite);

// Dashboard routes (summary, transactions)
router.use('/dashboard', require('./admin/dashboardRoutes'));

// Users management
router.use('/users', require('./admin/usersRoutes'));

// Listings management
router.use('/listings', require('./admin/listingsRoutes'));

// Requests management
router.use('/requests', require('./admin/requestsRoutes'));

// Transactions management
router.use('/transactions', require('./admin/transactionsRoutes'));

// Escrows management
router.use('/escrows', require('./admin/escrowRoutes'));

// Analytics and insights
router.use('/analytics', require('./admin/analyticsRoutes'));

// Payments management
router.use('/payments', require('./admin/paymentRoutes'));

// Promotions management
router.use('/promotions', require('./admin/promotionRoutes'));

// Messages & Reports management
router.use('/messages', require('./admin/messagesRoutes'));

// Staff management (list/update/suspend/remove)
router.use('/staff', require('./admin/staffRoutes'));

module.exports = router;
