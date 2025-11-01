const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createReview, listReviewsForUser } = require('../controllers/reviewsController');

router.post('/', verifyJWT, createReview);
router.get('/user/:userId', listReviewsForUser);

module.exports = router;
