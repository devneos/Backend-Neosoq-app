const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const isAdmin = require('../middleware/isAdmin');
const idempotency = require('../middleware/idempotency');
const { createEscrow, confirmEscrow, releaseEscrow, cancelEscrow, getEscrow, adminForceRelease, adminForceRefund } = require('../controllers/escrowController');
const { ledgerAudit } = require('../controllers/ledgerAuditController');

router.post('/', verifyJWT, createEscrow);
router.put('/:id/confirm', verifyJWT, confirmEscrow);
router.post('/:id/release', verifyJWT, releaseEscrow);
router.put('/:id/cancel', verifyJWT, cancelEscrow);
router.get('/:id', verifyJWT, getEscrow);

// Admin endpoints
router.get('/admin/ledger-audit', verifyJWT, isAdmin, ledgerAudit);

// Admin force actions (idempotent)
router.post('/:id/force-release', verifyJWT, isAdmin, idempotency, adminForceRelease);
router.post('/:id/force-refund', verifyJWT, isAdmin, idempotency, adminForceRefund);

module.exports = router;
