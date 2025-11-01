const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const { createRequest, getRequest, listRequests, updateRequest, deleteRequest } = require('../controllers/requestsController');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

// Allow multipart attachments on create and update
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'uploads', 'requests');
fs.mkdirSync(uploadDir, { recursive: true });
const multerStorage = multer ? multer.diskStorage({ destination: (req,file,cb) => cb(null, uploadDir), filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'-')) }) : null;
const upload = multer ? multer({ storage: multerStorage }).array('files', 5) : null;

router.post('/', verifyJWT, (req, res, next) => {
	if (multer) {
		upload(req, res, err => { if (err) return res.status(400).json({ error: err.message }); return createRequest(req,res,next); });
	} else {
		return createRequest(req,res,next);
	}
});
router.get('/', listRequests);
router.get('/:id', getRequest);
router.put('/:id', verifyJWT, (req, res, next) => {
	if (multer) {
		upload(req, res, err => { if (err) return res.status(400).json({ error: err.message }); return updateRequest(req,res,next); });
	} else {
		return updateRequest(req,res,next);
	}
});
router.delete('/:id', verifyJWT, deleteRequest);

module.exports = router;
