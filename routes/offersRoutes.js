const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createOffer, updateOffer, withdrawOffer, acceptOffer, completeOffer, listOffers } = require('../controllers/offersController');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }
const path = require('path');
const fs = require('fs');
// setup upload dir
const uploadDir = path.join(__dirname, '..', 'uploads', 'offers');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer ? multer.diskStorage({ destination: (req,file,cb) => cb(null, uploadDir), filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'-')) }) : null;
const upload = multer ? multer({ storage }).array('files', 5) : null;

// Accept multipart for attachments
router.post('/', verifyJWT, (req, res, next) => {
	if (multer) {
		upload(req, res, err => { if (err) return res.status(400).json({ error: err.message }); return createOffer(req,res,next); });
	} else {
		return createOffer(req,res,next);
	}
});

// Allow multipart on update so attachments can be added/removed
router.put('/:id', verifyJWT, (req, res, next) => {
	if (multer) {
		upload(req, res, err => { if (err) return res.status(400).json({ error: err.message }); return updateOffer(req,res,next); });
	} else {
		return updateOffer(req,res,next);
	}
});
router.put('/:id/withdraw', verifyJWT, withdrawOffer);
router.put('/:id/accept', verifyJWT, acceptOffer);
router.put('/:id/complete', verifyJWT, completeOffer);
router.get('/', listOffers);

module.exports = router;
