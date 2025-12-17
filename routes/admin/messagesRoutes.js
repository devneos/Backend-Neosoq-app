const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const controller = require('../../controllers/admin/messagesReportsController');

router.use(verifyJWT, isAdmin);

router.get('/summary', controller.summary);
router.get('/', controller.listMessages);
router.post('/:id/flag', controller.flagMessage);
router.post('/:id/unflag', controller.unflagMessage);
router.delete('/:id', controller.deleteMessage);

router.get('/reports', controller.listReports);
router.post('/reports/:id/status', controller.updateReportStatus);

router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);

module.exports = router;
