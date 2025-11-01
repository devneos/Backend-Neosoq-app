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
const { createListing, getListing, listListings, updateListing, deleteListing } = require('../controllers/listingsController');
const verifyJWT = require('../middleware/verifyJWT');

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
// Protect the route so we can attach listings to the creating user
// Create a listing
router.post('/', verifyJWT, (req, res, next) => {
  if (!multer) return res.status(500).json({ error: 'multer is not installed on the server' });
  upload(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    return createListing(req, res, next);
  });
});

// Search & list
router.get('/', listListings);

// Get single
router.get('/:id', getListing);

// Update
// Allow multipart on update so clients can remove some files and upload new ones
router.put('/:id', verifyJWT, (req, res, next) => {
  if (!multer) return res.status(500).json({ error: 'multer is not installed on the server' });
  upload(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    return updateListing(req, res, next);
  });
});

// Delete
router.delete('/:id', verifyJWT, (req, res, next) => {
  return deleteListing(req, res, next);
});

module.exports = router;
