const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }
const path = require('path');
const fs = require('fs');
const { attachFiles } = require('../controllers/uploadsController');

// setup upload directory
const uploadDir = path.join(__dirname, '..', 'uploads', 'temp');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer ? multer.diskStorage({ destination: (req,file,cb) => cb(null, uploadDir), filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'-')) }) : null;
const upload = multer ? multer({ storage }).any() : null;

// POST /uploads/attach
router.post('/attach', verifyJWT, (req, res, next) => {
  if (!multer) return res.status(500).json({ error: 'multer is not installed on the server' });
  upload(req, res, function (err) {
    if (err) return res.status(400).json({ error: err.message });
    return attachFiles(req, res, next);
  });
});

module.exports = router;
