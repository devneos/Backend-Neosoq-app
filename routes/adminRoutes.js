const express = require('express');
const router = express.Router();
const { createStaffInvite } = require('../controllers/adminController');
const verifyJWT = require('../middleware/verifyJWT');
const isAdmin = require('../middleware/isAdmin');

// POST /admin/staff/invite
router.post('/staff/invite', verifyJWT, isAdmin, createStaffInvite);

module.exports = router;
