const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createOffer, updateOffer, withdrawOffer, acceptOffer, completeOffer, listOffers } = require('../controllers/offersController');

// Use JSON body for create/update; attachments should be uploaded via
// POST /uploads/attach and passed back in the `files` property when creating/updating.
router.post('/', verifyJWT, createOffer);
router.put('/:id', verifyJWT, updateOffer);
router.put('/:id/withdraw', verifyJWT, withdrawOffer);
router.put('/:id/accept', verifyJWT, acceptOffer);
router.put('/:id/complete', verifyJWT, completeOffer);
router.get('/', listOffers);

module.exports = router;
