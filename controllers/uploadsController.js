const path = require('path');
const fs = require('fs');
const Listing = require('../models/Listing');
const Request = require('../models/Request');
const Offer = require('../models/Offer');
const Post = require('../models/Post');
const { uploadFile, destroyFile } = require('../helpers/cloudinary');
const { ensureLocalized } = require('../helpers/translate');

// Allowed mime types and max size
const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// POST /uploads/attach
// multipart/form-data with files and fields:
// - ownerType: 'listing' | 'request' | 'offer'
// - ownerId: the document id
// - descriptions[] (optional): descriptions aligned with files order
const attachFiles = async (req, res) => {
  try {
    const ownerType = req.body.ownerType;
    const ownerId = req.body.ownerId;
  if (!ownerType || !['listing','request','offer','post'].includes(ownerType)) return res.status(400).json({ error: 'ownerType must be one of listing|request|offer|post' });
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });

    const files = req.files || [];
    const descriptions = req.body.descriptions || req.body.description || [];
    // descriptions may be string, single value or array
    let descArr = [];
    if (typeof descriptions === 'string') {
      try { descArr = JSON.parse(descriptions); } catch (e) { descArr = [descriptions]; }
    } else if (Array.isArray(descriptions)) descArr = descriptions;

    // Validate size/type
    for (const f of files) {
      if (!ALLOWED.includes(f.mimetype)) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) {} });
        return res.status(400).json({ error: 'Invalid file type' });
      }
      if (f.size > MAX_BYTES) {
        files.forEach(file => { try { fs.unlinkSync(file.path); } catch (e) {} });
        return res.status(400).json({ error: 'File too large. Max 10MB per file' });
      }
    }

    // Lookup owner doc
    let owner = null;
  if (ownerType === 'listing') owner = await Listing.findById(ownerId);
  if (ownerType === 'request') owner = await Request.findById(ownerId);
  if (ownerType === 'offer') owner = await Offer.findById(ownerId);
  if (ownerType === 'post') owner = await Post.findById(ownerId);
    if (!owner) return res.status(404).json({ error: `${ownerType} not found` });

    const addedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let uploadRes = null;
      try {
        uploadRes = await uploadFile(f.path, { public_id: `${ownerType}/${Date.now()}-${path.basename(f.originalname, path.extname(f.originalname))}` });
      } catch (err) {
        console.error('Cloudinary upload failed for', f.originalname, err && err.message);
      }
      const url = uploadRes && uploadRes.url ? uploadRes.url : null;
      const publicId = uploadRes && (uploadRes.public_id || uploadRes.publicId) ? (uploadRes.public_id || uploadRes.publicId) : null;
      let desc = descArr[i] || '';
      try { desc = await ensureLocalized(desc); } catch (e) { /* leave as string if it fails */ }

      const fileDoc = {
        filename: f.filename || f.originalname,
        originalname: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        path: f.path,
        urlSrc: url,
        publicId,
        description: desc
      };

      // attach to owner
      if (ownerType === 'listing') {
        if (f.mimetype && f.mimetype.startsWith('image') && url) owner.images = owner.images || [], owner.images.push(url);
        owner.files = owner.files || [];
        owner.files.push(fileDoc);
      } else if (ownerType === 'request') {
        owner.files = owner.files || [];
        if (f.mimetype && f.mimetype.startsWith('image') && url) owner.images = owner.images || [], owner.images.push(url);
        owner.files.push(fileDoc);
      } else if (ownerType === 'offer') {
        owner.files = owner.files || [];
        owner.files.push(fileDoc);
        } else if (ownerType === 'post') {
          owner.files = owner.files || [];
          // Posts may include images; push file metadata
          if (f.mimetype && f.mimetype.startsWith('image') && url) owner.images = owner.images || [], owner.images.push(url);
          owner.files.push(fileDoc);
      }

      // cleanup local
      try { fs.unlinkSync(f.path); } catch (e) {}
      addedFiles.push(fileDoc);
    }

    await owner.save();

    return res.status(201).json({ success: true, files: addedFiles });
  } catch (e) {
    console.error('attachFiles', e);
    return res.status(500).json({ error: 'Failed to attach files' });
  }
};

module.exports = { attachFiles };
