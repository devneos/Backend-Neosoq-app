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
    const {
      title,
      description,
      projectType,
      pricingType,
      price,
      contactName,
      contactPhone,
      area,
      addressLine,
      city,
      state,
      country,
      deadline,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const t = await ensureLocalized(title);
    const d = await ensureLocalized(description);
    // Attachments should be uploaded via the uploads endpoint. Accept files
    // metadata in the JSON body (`files`) as an array (or JSON string).
    let fileDocs = [];
    if (req.body.files) {
      try { fileDocs = typeof req.body.files === 'string' ? JSON.parse(req.body.files) : req.body.files; } catch (e) { fileDocs = req.body.files; }
    }

    const location = {
      area: area || undefined,
      addressLine: addressLine || undefined,
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
    };

    const request = await Request.create({
      title: t,
      description: d,
      projectType,
      pricingType,
      price: price ? Number(price) : undefined,
      files: fileDocs,
      createdBy: req.user?.id,
      contactName: contactName || undefined,
      contactPhone: contactPhone || undefined,
      location,
      deadline: deadline ? new Date(deadline) : undefined,
    });
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
    const request = await Request.findById(id).lean();
    if (!request) return res.status(404).json({ error: 'Not found' });
    // Check if liked by current user
    let isLikedByMe = false;
    if (req.user?.id) {
      const SavedItem = require('../models/SavedItem');
      const saved = await SavedItem.findOne({ userId: req.user.id, itemId: id, itemType: 'Request' });
      isLikedByMe = !!saved;
    }
    // Return full localized title/description so the client can pick language
    return res.json({ request: { ...request, isLikedByMe, timeAgo: timeAgo(request.createdAt) } });
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
    // Check if liked by current user (bulk query)
    const SavedItem = require('../models/SavedItem');
    const ids = docs.map(d => d._id);
    let likedMap = {};
    if (req.user?.id && ids.length) {
      const savedItems = await SavedItem.find({ userId: req.user.id, itemId: { $in: ids }, itemType: 'Request' }).lean();
      likedMap = savedItems.reduce((acc, cur) => { acc[String(cur.itemId)] = true; return acc; }, {});
    }
  // Return full localized objects (title/description) instead of a single language
  const out = docs.map(d => ({ ...d, title: d.title || { en: '', ar: '' }, description: d.description || { en: '', ar: '' }, isLikedByMe: likedMap[String(d._id)] || false, timeAgo: timeAgo(d.createdAt) }));
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

    // Accept newly attached files metadata in data.files (uploaded via uploads endpoint)
    let newFiles = [];
    if (data.files) {
      try { newFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files; } catch (e) { newFiles = data.files; }
    }
    if (Array.isArray(newFiles) && newFiles.length) {
      for (const fdoc of newFiles) {
        reqDoc.files.push(fdoc);
      }
    }

    // apply other updates
    Object.keys(data).forEach(k => {
      if (['removedFiles','removed','files'].includes(k)) return;
      if (['deadline'].includes(k) && data[k]) {
        reqDoc[k] = new Date(data[k]);
        return;
      }
      if (['area','addressLine','city','state','country'].includes(k)) {
        reqDoc.location = reqDoc.location || {};
        reqDoc.location[k] = data[k];
        return;
      }
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
