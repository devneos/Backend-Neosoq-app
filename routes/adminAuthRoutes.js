const express = require('express');
const router = express.Router();
const { adminSignIn } = require('../controllers/adminAuthController');

// POST /admin/auth/signin
router.post('/signin', adminSignIn);

module.exports = router;
