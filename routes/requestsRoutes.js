const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createRequest, getRequest, listRequests, updateRequest, deleteRequest } = require('../controllers/requestsController');

router.post('/', verifyJWT, createRequest);
router.get('/', listRequests);
router.get('/:id', getRequest);
router.put('/:id', verifyJWT, updateRequest);
router.delete('/:id', verifyJWT, deleteRequest);

module.exports = router;
