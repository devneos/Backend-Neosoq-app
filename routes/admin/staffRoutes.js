const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const controller = require('../../controllers/admin/staffController');

router.use(verifyJWT, isAdmin);

router.get('/', controller.listStaff);
router.put('/:id', controller.updateStaff);
router.post('/:id/suspend', controller.suspendStaff);
router.delete('/:id', controller.removeStaff);

module.exports = router;
