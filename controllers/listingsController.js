const Listing = require('../models/Listing');
const path = require('path');
const fs = require('fs');
const { enqueueJob } = require('../utils/fileQueue');
const { uploadFile } = require('../helpers/cloudinary');
const { ensureLocalized } = require('../helpers/translate');
const timeAgo = require('../helpers/timeAgo');
const Offer = require('../models/Offer');

// Allowed mime types and max size
const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Create listing (supports localized input)
const createListing = async (req, res) => {
  try {
    const { category, subCategory, price, quantity, condition } = req.body;
    // title/description can be provided as title (string) or title_en/title_ar
    const titleInput = req.body.title || req.body.title_en || req.body.title_en || null;
    const descriptionInput = req.body.description || req.body.description_en || null;

    if (!category || !titleInput) {
      return res.status(400).json({ error: 'category and title are required' });
    }

    const title = await ensureLocalized(titleInput);
    const description = await ensureLocalized(descriptionInput);

    // Attachments are handled by a dedicated uploads endpoint. After uploading
    // files via that endpoint clients should pass `files` and/or `images`
    // metadata in the JSON body (as arrays). Accept either raw arrays or
    // JSON-encoded strings to maintain compatibility with existing clients.
    let fileDocs = [];
    let images = [];
    if (req.body.files) {
      try { fileDocs = typeof req.body.files === 'string' ? JSON.parse(req.body.files) : req.body.files; } catch (e) { fileDocs = req.body.files; }
    }
    if (req.body.images) {
      try { images = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images; } catch (e) { images = req.body.images; }
    }

    // Backwards-compatible inline multipart handling: if req.files is present
    // (route used multer), upload them directly and attach to the listing.
    if (req.files && Array.isArray(req.files) && req.files.length) {
      const files = req.files;
      // validate
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

      for (const f of files) {
        let uploadRes = null;
        try {
          uploadRes = await uploadFile(f.path, { public_id: `listings/${Date.now()}-${path.basename(f.originalname, path.extname(f.originalname))}` });
        } catch (err) {
          console.error('Cloudinary upload failed for', f.originalname, err.message || err);
        }
        const url = uploadRes && uploadRes.url ? uploadRes.url : null;
        const publicId = uploadRes && uploadRes.public_id ? uploadRes.public_id : null;
        if (f.mimetype && f.mimetype.startsWith('image') && url) images.push(url);
  fileDocs.push({ filename: f.filename, originalname: f.originalname, mimeType: f.mimetype, size: f.size, path: f.path, urlSrc: url, publicId, description: { en: '', ar: '' } });
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    }

    const listing = await Listing.create({
      category,
      subCategory,
      title,
      description,
      price: price ? Number(price) : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      condition,
      files: fileDocs,
      images,
      reviewCompleted: false,
      createdBy: req.user?.id || null,
    });

    // Enqueue email job instead of sending synchronously
    const fileListHtml = fileDocs.map(f => `<li>${f.originalname} - ${f.urlSrc ? `<a href=\"${f.urlSrc}\">file</a>` : 'attached (local)'}</li>`).join('');
    const message = `A new listing has been created for review.<br/><br/>\n      <strong>Title:</strong> ${listing.title.en}<br/>\n      <strong>Category:</strong> ${listing.category}<br/>\n      <strong>Description:</strong> ${listing.description.en || ''}<br/>\n      <strong>Files:</strong><ul>${fileListHtml}</ul>`;

    try {
      await enqueueJob({ type: 'listing_email', to: process.env.RECIPIENT_EMAIL || 'dev@neosoq.com', subject: 'Listing for review', message, files: fileDocs });
    } catch (e) {
      console.error('Failed to enqueue email job', e);
    }

    const payload = listing.toObject();
    payload.timeAgo = timeAgo(listing.createdAt);
    payload.seller = null;
    if (listing.createdBy) {
      // populate minimal seller info
      const User = require('../models/User');
      const seller = await User.findById(listing.createdBy).select('username profileImage roles position country region').lean();
      if (seller) payload.seller = { id: seller._id, username: seller.username, profileImage: seller.profileImage, roles: seller.roles, position: seller.position, country: seller.country, region: seller.region };
    }

    return res.status(201).json({ listing: payload });
  } catch (error) {
    console.error('createListing error', error);
    return res.status(500).json({ error: 'Failed to create listing' });
  }
};

// GET /listings/:id
// Return full localized title/description (both languages) rather than
// selecting a specific language on the server.
const getListing = async (req, res) => {
  try {
    const id = req.params.id;
    const listing = await Listing.findById(id).lean();
    if (!listing) return res.status(404).json({ error: 'Not found' });

    // populate seller info
    const User = require('../models/User');
    let seller = null;
    if (listing.createdBy) {
      const s = await User.findById(listing.createdBy).select('username profileImage roles position country region rating ratingCount sellerType').lean();
      if (s) seller = { id: s._id, username: s.username, profileImage: s.profileImage, roles: s.roles, position: s.position, country: s.country, region: s.region, rating: s.rating || 5.0, ratingCount: s.ratingCount || 0, sellerType: s.sellerType || 'seller' };
    }

    // offers count
    const offersCount = await Offer.countDocuments({ listingId: id });

    // Check if liked by current user
    let isLikedByMe = false;
    if (req.user?.id) {
      const SavedItem = require('../models/SavedItem');
      const saved = await SavedItem.findOne({ userId: req.user.id, itemId: id, itemType: 'Listing' });
      isLikedByMe = !!saved;
    }

    // Return the full localized objects for title/description so clients
    // can choose which language to display.
    const result = {
      ...listing,
      title: listing.title || { en: '', ar: '' },
      description: listing.description || { en: '', ar: '' },
      seller,
      offersCount,
      isLikedByMe,
      timeAgo: require('../helpers/timeAgo')(listing.createdAt),
    };

    return res.json({ listing: result });
  } catch (e) {
    console.error('getListing', e);
    return res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

// GET /listings (search & filter)
const listListings = async (req, res) => {
  try {
    const { search, minPrice, maxPrice, condition, category, subCategory, status, page = 1, limit = 20 } = req.query;
    const q = { };
    if (category) q.category = { $in: category.split(',') };
    if (subCategory) q.subCategory = { $in: subCategory.split(',') };
    if (status) q.status = status;
    if (condition) q.condition = condition;
    if (minPrice || maxPrice) q.price = {};
    if (minPrice) q.price.$gte = Number(minPrice);
    if (maxPrice) q.price.$lte = Number(maxPrice);

    // text search on title.en, description.en
    if (search) {
      q.$or = [ { 'title.en': { $regex: search, $options: 'i' } }, { 'description.en': { $regex: search, $options: 'i' } } ];
    }

    const skip = (Number(page) - 1) * Number(limit);
  const totalCount = await Listing.countDocuments(q);
  const docs = await Listing.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    // populate seller info for each and aggregate offer counts in bulk
    const User = require('../models/User');
    const SavedItem = require('../models/SavedItem');
    const out = [];
    const ids = docs.map(d => d._id);
    let countsMap = {};
    if (ids.length) {
      const agg = await Offer.aggregate([
        { $match: { listingId: { $in: ids } } },
        { $group: { _id: '$listingId', count: { $sum: 1 } } }
      ]);
      countsMap = agg.reduce((acc, cur) => { acc[String(cur._id)] = cur.count; return acc; }, {});
    }
    // Check if liked by current user (bulk query)
    let likedMap = {};
    if (req.user?.id && ids.length) {
      const savedItems = await SavedItem.find({ userId: req.user.id, itemId: { $in: ids }, itemType: 'Listing' }).lean();
      likedMap = savedItems.reduce((acc, cur) => { acc[String(cur.itemId)] = true; return acc; }, {});
    }
    for (const doc of docs) {
      const seller = doc.createdBy ? await User.findById(doc.createdBy).select('username profileImage roles position country region rating ratingCount sellerType').lean() : null;
      const offersCount = countsMap[String(doc._id)] || 0;
      const isLikedByMe = likedMap[String(doc._id)] || false;
      out.push({
        ...doc,
        // Return full localized objects for client-side selection
        title: doc.title || { en: '', ar: '' },
        description: doc.description || { en: '', ar: '' },
        seller: seller ? { id: seller._id, username: seller.username, profileImage: seller.profileImage, roles: seller.roles, position: seller.position, country: seller.country, region: seller.region, rating: seller.rating || 5.0, ratingCount: seller.ratingCount || 0, sellerType: seller.sellerType || 'seller' } : null,
        offersCount,
        isLikedByMe,
        timeAgo: timeAgo(doc.createdAt),
      });
    }

  const totalPages = Math.ceil(totalCount / Number(limit));
  return res.json({ listings: out, page: Number(page), limit: Number(limit), totalCount, totalPages });
  } catch (e) {
    console.error('listListings', e);
    return res.status(500).json({ error: 'Failed to query listings' });
  }
};

// Update listing - supports removing existing files and adding new uploads
const updateListing = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body || {};
    if (data.title) data.title = await ensureLocalized(data.title);
    if (data.description) data.description = await ensureLocalized(data.description);

  const listing = await Listing.findById(id);
  // ownership check
  if (!listing) return res.status(404).json({ error: 'Not found' });
  if (String(listing.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });

    // handle removed files passed by client (removedFiles can be JSON string or array)
    let removed = data.removedFiles || data.removed || null;
    if (removed) {
      if (typeof removed === 'string') {
        try { removed = JSON.parse(removed); } catch (e) { removed = removed.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (Array.isArray(removed) && removed.length) {
        // attempt remote deletion when publicId exists
        const { destroyFile } = require('../helpers/cloudinary');
        for (const r of removed) {
          const match = listing.files.find(f => f.urlSrc === r || f.filename === r || f.originalname === r);
          if (match && match.publicId) {
            try { await destroyFile(match.publicId); } catch (e) { /* ignore */ }
          }
        }
        listing.files = listing.files.filter(f => !removed.includes(f.urlSrc) && !removed.includes(f.filename) && !removed.includes(f.originalname));
        listing.images = listing.images.filter(img => !removed.includes(img));
      }
    }

    // Newly attached files should be provided through the uploads endpoint.
    // Accept files metadata passed in the JSON body (e.g. after upload).
    let newFiles = [];
    if (data.files) {
      try { newFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files; } catch (e) { newFiles = data.files; }
    }
    if (Array.isArray(newFiles) && newFiles.length) {
      for (const fdoc of newFiles) {
        if (fdoc.mimeType && fdoc.mimeType.startsWith('image') && fdoc.urlSrc) listing.images.push(fdoc.urlSrc);
        listing.files.push(fdoc);
      }
    }

    // apply other updates from data
    Object.keys(data).forEach(k => {
      if (['removedFiles','removed','files'].includes(k)) return;
      listing[k] = data[k];
    });

    await listing.save();
    const out = listing.toObject();
    out.timeAgo = timeAgo(listing.updatedAt);
    return res.json({ listing: out });
  } catch (e) {
    console.error('updateListing', e);
    return res.status(500).json({ error: 'Failed to update listing' });
  }
};

// Delete listing
const deleteListing = async (req, res) => {
  try {
    const id = req.params.id;
    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (String(listing.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    // optionally delete remote assets
    const { destroyFile } = require('../helpers/cloudinary');
    for (const f of (listing.files || [])) {
      if (f.publicId) { try { await destroyFile(f.publicId); } catch (e) { /* ignore */ } }
    }
    await Listing.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteListing', e);
    return res.status(500).json({ error: 'Failed to delete listing' });
  }
};

module.exports = { createListing, getListing, listListings, updateListing, deleteListing };
