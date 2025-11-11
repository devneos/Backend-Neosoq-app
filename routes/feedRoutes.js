const express = require('express');
const router = express.Router();
const { getFeed } = require('../controllers/feedController');

// Public feed endpoint
router.get('/', getFeed);

module.exports = router;
