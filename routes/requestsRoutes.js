const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createRequest, getRequest, listRequests, updateRequest, deleteRequest } = require('../controllers/requestsController');

// Use JSON body for create/update. Attachments should be uploaded via
// POST /uploads/attach and then referenced in `files` when creating/updating.
router.post('/', verifyJWT, createRequest);
router.get('/', listRequests);
router.get('/:id', getRequest);
router.put('/:id', verifyJWT, updateRequest);
router.delete('/:id', verifyJWT, deleteRequest);

module.exports = router;
