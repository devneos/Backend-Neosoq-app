const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const requestsController = require('../../controllers/admin/requestsController');

router.get('/', verifyJWT, isAdmin, requestsController.listRequests);
router.get('/:id', verifyJWT, isAdmin, requestsController.getRequestDetails);
router.post('/:id/approve', verifyJWT, isAdmin, requestsController.approveRequest);
router.post('/:id/reject', verifyJWT, isAdmin, requestsController.rejectRequest);
router.delete('/:id', verifyJWT, isAdmin, requestsController.deleteRequest);

module.exports = router;
