const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/profileController');

router.put('/edit', verifyJWT, ctrl.editProfile);

module.exports = router;
