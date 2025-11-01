const Request = require('../models/Request');
const { ensureLocalized } = require('../helpers/translate');
const timeAgo = require('../helpers/timeAgo');
const path = require('path');
const fs = require('fs');
const { uploadFile, cloudinary } = require('../helpers/cloudinary');

// Allowed mime types and max size (same as listings)
const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const createRequest = async (req, res) => {
  try {
    const { title, description, projectType, pricingType, price } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const t = await ensureLocalized(title);
    const d = await ensureLocalized(description);
    // handle attachments from req.files
    const files = req.files || [];
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

    const fileDocs = [];
    for (const f of files) {
      let url = null;
      try {
        url = await uploadFile(f.path, { public_id: `requests/${Date.now()}-${path.basename(f.originalname, path.extname(f.originalname))}` });
      } catch (err) {
        console.error('Cloudinary upload failed for', f.originalname, err && err.message);
      }
      fileDocs.push({ filename: f.filename || f.originalname, originalname: f.originalname, mimeType: f.mimetype, size: f.size, path: f.path, urlSrc: url });
      try { fs.unlinkSync(f.path); } catch (e) {}
    }

    const request = await Request.create({ title: t, description: d, projectType, pricingType, price: price ? Number(price) : undefined, files: fileDocs, createdBy: req.user?.id });
    const payload = request.toObject();
    payload.timeAgo = timeAgo(request.createdAt);
    return res.status(201).json({ request: payload });
  } catch (e) {
    console.error('createRequest', e);
    return res.status(500).json({ error: 'Failed to create request' });
  }
};

const getRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const lang = req.query.lang || 'en';
    const request = await Request.findById(id).lean();
    if (!request) return res.status(404).json({ error: 'Not found' });
    return res.json({ request: { ...request, title: (request.title && request.title[lang]) ? request.title[lang] : request.title.en, description: (request.description && request.description[lang]) ? request.description[lang] : request.description.en, timeAgo: timeAgo(request.createdAt) } });
  } catch (e) {
    console.error('getRequest', e);
    return res.status(500).json({ error: 'Failed to fetch request' });
  }
};

const listRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const docs = await Request.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(d => ({ ...d, title: d.title && d.title.en, description: d.description && d.description.en, timeAgo: timeAgo(d.createdAt) }));
    return res.json({ requests: out, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error('listRequests', e);
    return res.status(500).json({ error: 'Failed to list requests' });
  }
};

const updateRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body || {};
    if (data.title) data.title = await ensureLocalized(data.title);
    if (data.description) data.description = await ensureLocalized(data.description);

  const reqDoc = await Request.findById(id);
  if (!reqDoc) return res.status(404).json({ error: 'Not found' });
  // ownership check
  if (String(reqDoc.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });

    // handle removed files: client may send removedFiles as JSON array or comma-separated string
    let removed = data.removedFiles || data.removed || null;
    if (removed) {
      if (typeof removed === 'string') {
        try { removed = JSON.parse(removed); } catch (e) { removed = removed.split(',').map(s => s.trim()).filter(Boolean); }
      }
        if (Array.isArray(removed) && removed.length) {
          // attempt remote deletion when publicId exists
          const { destroyFile } = require('../helpers/cloudinary');
          for (const r of removed) {
            const match = reqDoc.files.find(f => f.urlSrc === r || f.filename === r || f.originalname === r);
            if (match && match.publicId) {
              try { await destroyFile(match.publicId); } catch (e) { /* ignore */ }
            }
          }
          reqDoc.files = reqDoc.files.filter(f => !removed.includes(f.urlSrc) && !removed.includes(f.filename) && !removed.includes(f.originalname));
        }
    }

    // handle newly uploaded files in req.files
    const files = req.files || [];
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
    if (files.length) {
      for (const f of files) {
        let uploadRes = null;
        try { uploadRes = await uploadFile(f.path, { public_id: `requests/${Date.now()}-${path.basename(f.originalname, path.extname(f.originalname))}` }); } catch (err) { console.error('Cloudinary upload failed for', f.originalname, err && err.message); }
        const url = uploadRes && uploadRes.url ? uploadRes.url : null;
        const publicId = uploadRes && uploadRes.public_id ? uploadRes.public_id : null;
        reqDoc.files.push({ filename: f.filename || f.originalname, originalname: f.originalname, mimeType: f.mimetype, size: f.size, path: f.path, urlSrc: url, publicId });
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    }

    // apply other updates
    Object.keys(data).forEach(k => {
      if (['removedFiles','removed','files'].includes(k)) return;
      reqDoc[k] = data[k];
    });

    await reqDoc.save();
    return res.json({ request: reqDoc.toObject() });
  } catch (e) {
    console.error('updateRequest', e);
    return res.status(500).json({ error: 'Failed to update request' });
  }
};

const deleteRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const reqDoc = await Request.findById(id);
    if (!reqDoc) return res.status(404).json({ error: 'Not found' });
    if (String(reqDoc.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    const { destroyFile } = require('../helpers/cloudinary');
    for (const f of (reqDoc.files || [])) { if (f.publicId) { try { await destroyFile(f.publicId); } catch (e) {} } }
    await Request.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteRequest', e);
    return res.status(500).json({ error: 'Failed to delete request' });
  }
};

module.exports = { createRequest, getRequest, listRequests, updateRequest, deleteRequest };
