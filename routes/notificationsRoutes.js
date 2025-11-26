const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/notificationsController');

router.get('/', verifyJWT, ctrl.fetchNotifications);
router.put('/read', verifyJWT, ctrl.markAllRead);
router.delete('/clear', verifyJWT, ctrl.clearAll);

module.exports = router;
