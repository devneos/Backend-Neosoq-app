const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/accountController');

router.delete('/close', verifyJWT, ctrl.closeAccount);

module.exports = router;
