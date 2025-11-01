const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createOffer, updateOffer, withdrawOffer, acceptOffer, completeOffer, listOffers } = require('../controllers/offersController');

router.post('/', verifyJWT, createOffer);
router.put('/:id', verifyJWT, updateOffer);
router.put('/:id/withdraw', verifyJWT, withdrawOffer);
router.put('/:id/accept', verifyJWT, acceptOffer);
router.put('/:id/complete', verifyJWT, completeOffer);
router.get('/', listOffers);

module.exports = router;
