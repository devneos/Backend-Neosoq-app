const Listing = require('../models/Listing');
const path = require('path');
const fs = require('fs');
const { enqueueJob } = require('../utils/fileQueue');
const cloudinary = require('cloudinary').v2;

// Allowed mime types and max size
const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Configure cloudinary if env provided
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
}

const uploadFileToCloudinary = async (filePath, originalname) => {
  if (!cloudinary.config().cloud_name) return null;
  // use resource_type 'auto' so Cloudinary accepts images & docs
  const res = await cloudinary.uploader.upload(filePath, { resource_type: 'auto', public_id: `listings/${Date.now()}-${path.basename(originalname, path.extname(originalname))}` });
  return res.secure_url;
};

const createListing = async (req, res) => {
  try {
    const { category, subCategory, title, description, price, quantity, condition } = req.body;

    if (!category || !title) {
      return res.status(400).json({ error: 'category and title are required' });
    }

    // Validate files
    const files = req.files || [];
    for (const f of files) {
      if (!ALLOWED.includes(f.mimetype)) {
        // remove uploaded files
        files.forEach(file => {
          try { fs.unlinkSync(file.path); } catch (e) {}
        });
        return res.status(400).json({ error: 'Invalid file type' });
      }
      if (f.size > MAX_BYTES) {
        files.forEach(file => {
          try { fs.unlinkSync(file.path); } catch (e) {}
        });
        return res.status(400).json({ error: 'File too large. Max 10MB per file' });
      }
    }

    // Upload files to Cloudinary if configured and collect file docs
    const fileDocs = [];
    for (const f of files) {
      let url = null;
      try {
        url = await uploadFileToCloudinary(f.path, f.originalname);
      } catch (err) {
        console.error('Cloudinary upload failed for', f.originalname, err);
      }
      fileDocs.push({ filename: f.filename, originalname: f.originalname, mimeType: f.mimetype, size: f.size, path: f.path, urlSrc: url });
      // remove local file after upload attempt
      try { fs.unlinkSync(f.path); } catch (e) {}
    }

    const listing = await Listing.create({
      category,
      subCategory,
      title,
      description,
      price,
      quantity: quantity ? Number(quantity) : undefined,
      condition,
      files: fileDocs,
      reviewCompleted: false,
      createdBy: req.user?.id || null,
    });

    // Enqueue email job instead of sending synchronously
    const fileListHtml = fileDocs.map(f => `<li>${f.originalname} - ${f.urlSrc ? `<a href="${f.urlSrc}">file</a>` : 'attached (local)'}</li>`).join('');
    const message = `A new listing has been created for review.<br/><br/>
      <strong>Title:</strong> ${listing.title}<br/>
      <strong>Category:</strong> ${listing.category}<br/>
      <strong>Description:</strong> ${listing.description || ''}<br/>
      <strong>Files:</strong><ul>${fileListHtml}</ul>`;

    try {
      await enqueueJob({ type: 'listing_email', to: process.env.RECIPIENT_EMAIL || 'dev@neosoq.com', subject: 'Listing for review', message, files: fileDocs });
    } catch (e) {
      console.error('Failed to enqueue email job', e);
    }

    return res.status(201).json({ listing });
  } catch (error) {
    console.error('createListing error', error);
    return res.status(500).json({ error: 'Failed to create listing' });
  }
};

module.exports = { createListing };
