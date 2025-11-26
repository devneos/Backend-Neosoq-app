const express = require('express');
const router = express.Router();
const verifyJWT = require('../../middleware/verifyJWT');
const isAdmin = require('../../middleware/isAdmin');
const controller = require('../../controllers/admin/listingsController');

router.get('/', verifyJWT, isAdmin, controller.listListings);
router.get('/:id', verifyJWT, isAdmin, controller.getListingDetails);
router.post('/:id/approve', verifyJWT, isAdmin, controller.approveListing);
router.post('/:id/reject', verifyJWT, isAdmin, controller.rejectListing);
router.delete('/:id', verifyJWT, isAdmin, controller.deleteListing);

module.exports = router;
