const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const { listEscrows, getEscrowDetails, adminForceRelease, adminForceRefund } = require('../../controllers/admin/escrowController');

// GET /admin/escrows
router.get('/', verifyJWT, isAdmin, listEscrows);

// GET /admin/escrows/:id
router.get('/:id', verifyJWT, isAdmin, getEscrowDetails);

// POST /admin/escrows/:id/force-release
router.post('/:id/force-release', verifyJWT, isAdmin, adminForceRelease);

// POST /admin/escrows/:id/force-refund
router.post('/:id/force-refund', verifyJWT, isAdmin, adminForceRefund);

module.exports = router;
