const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/contractsController');

router.get('/', verifyJWT, ctrl.listContracts);
router.get('/:id', verifyJWT, ctrl.getContract);
router.post('/', verifyJWT, ctrl.createContract);
router.post('/:id/complete', verifyJWT, ctrl.markComplete);
router.post('/:id/cancel', verifyJWT, ctrl.cancelContract);

module.exports = router;
