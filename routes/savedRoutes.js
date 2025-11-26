const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ctrl = require('../controllers/savedItemsController');

router.post('/', verifyJWT, ctrl.addSavedItem);
router.delete('/:id', verifyJWT, ctrl.removeSavedItem);
router.get('/', verifyJWT, ctrl.fetchSaved);

module.exports = router;
