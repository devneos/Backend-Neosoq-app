const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createDispute, getDispute, listDisputes, updateDispute, deleteDispute } = require('../controllers/disputesController');

router.post('/', verifyJWT, createDispute);
router.get('/', listDisputes);
router.get('/:id', getDispute);
router.put('/:id', verifyJWT, updateDispute);
router.delete('/:id', verifyJWT, deleteDispute);

module.exports = router;
