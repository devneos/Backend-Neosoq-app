const express = require('express');
const router = express.Router();
let multer;
try {
  multer = require('multer');
} catch (e) {
  // multer not installed in this environment (dev). We'll throw a clearer error
  // when the route is actually used.
  multer = null;
}
const path = require('path');
const fs = require('fs');
const { createListing } = require('../controllers/listingsController');

// ensure uploads dir exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'listings');
fs.mkdirSync(uploadDir, { recursive: true });

// multer storage
const storage = multer ? multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '-'));

  }
}) : null;

const upload = multer ? multer({ storage }).array('files', 10) : null;

// POST /listings
router.post('/', (req, res, next) => {
  if (!multer) return res.status(500).json({ error: 'multer is not installed on the server' });
  upload(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    return createListing(req, res, next);
  });
});

module.exports = router;
