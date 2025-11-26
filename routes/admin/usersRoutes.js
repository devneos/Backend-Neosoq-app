const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const usersController = require('../../controllers/admin/usersController');

router.get('/summary', verifyJWT, isAdmin, usersController.getSummaryUsers);
router.get('/', verifyJWT, isAdmin, usersController.listUsers);
router.post('/:id/ban', verifyJWT, isAdmin, usersController.banUser);

module.exports = router;
