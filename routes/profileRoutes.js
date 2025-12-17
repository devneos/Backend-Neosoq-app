const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/profileController');

router.get('/me', verifyJWT, ctrl.getMyProfile);
router.get('/:id', verifyJWT, ctrl.getUserProfile);
router.put('/edit', verifyJWT, ctrl.editProfile);

module.exports = router;
