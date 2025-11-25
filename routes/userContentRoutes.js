const express = require('express');
const router = express.Router();
const { getUserListings, getUserOffers, getUserPosts, getUserRequests } = require('../controllers/userContentController');

// Public endpoints to fetch content created by a user along with basic user profile
router.get('/:id/listings', getUserListings);
router.get('/:id/offers', getUserOffers);
router.get('/:id/posts', getUserPosts);
router.get('/:id/requests', getUserRequests);

module.exports = router;
