const express = require('express');
const router = express.Router();
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }
const path = require('path');
const fs = require('fs');
const { createListing, getListing, listListings, updateListing, deleteListing } = require('../controllers/listingsController');
const verifyJWT = require('../middleware/verifyJWT');

// ensure uploads dir exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'listings');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer ? multer.diskStorage({ destination: function (req, file, cb) { cb(null, uploadDir); }, filename: function (req, file, cb) { const unique = Date.now() + '-' + Math.round(Math.random() * 1E9); cb(null, unique + '-' + file.originalname.replace(/\s+/g, '-')); } }) : null;
const upload = multer ? multer({ storage }).any() : null;

// POST /listings
// Use raw JSON body for creating listings. For backward compatibility we
// still accept multipart/form-data: when Content-Type is multipart we'll
// parse files with multer and pass them to the controller. Otherwise we
// assume a JSON body and call the controller directly.
router.post('/', verifyJWT, (req, res, next) => {
  const isMultipart = req.is('multipart/form-data');
  if (isMultipart) {
    if (!multer) return res.status(500).json({ error: 'multer is not installed on the server' });
    upload(req, res, function (err) {
      if (err) return res.status(400).json({ error: err.message });
      return createListing(req, res, next);
    });
  } else {
    return createListing(req, res, next);
  }
});

// Search & list
router.get('/', listListings);

// Get single
router.get('/:id', getListing);

// Update (use JSON body; attachments should be handled via /uploads/attach)
router.put('/:id', verifyJWT, updateListing);

// Delete
router.delete('/:id', verifyJWT, (req, res, next) => {
  return deleteListing(req, res, next);
});

module.exports = router;
