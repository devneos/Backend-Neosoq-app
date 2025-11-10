const Offer = require('../models/Offer');
const Listing = require('../models/Listing');
const Request = require('../models/Request');
const timeAgo = require('../helpers/timeAgo');

const createOffer = async (req, res) => {
  try {
    const { listingId, requestId, price, proposalText } = req.body;
    if (!listingId && !requestId) return res.status(400).json({ error: 'listingId or requestId required' });
    if (!price) return res.status(400).json({ error: 'price required' });

  // proposalText should be stored as localized object
  const { ensureLocalized } = require('../helpers/translate');
  let localizedProposal = undefined;
  if (proposalText) localizedProposal = await ensureLocalized(proposalText);

  // File attachments are handled by a dedicated uploads endpoint. Accept
  // metadata in the JSON body (e.g. after upload) under `files`.
    let fileDocs = [];
    if (req.body.files) {
      try { fileDocs = typeof req.body.files === 'string' ? JSON.parse(req.body.files) : req.body.files; } catch (e) { fileDocs = req.body.files; }
    }

  const offer = await Offer.create({ listingId, requestId, userId: req.user?.id, price: Number(price), proposalText: localizedProposal, files: fileDocs });
    const payload = offer.toObject();
    payload.timeAgo = timeAgo(offer.createdAt);
    return res.status(201).json({ offer: payload });
  } catch (e) {
    console.error('createOffer', e);
    return res.status(500).json({ error: 'Failed to create offer' });
  }
};

const updateOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ error: 'Not found' });
    if (String(offer.userId) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    const data = req.body || {};

    const { ensureLocalized } = require('../helpers/translate');

    // handle removed files
    let removed = data.removedFiles || data.removed || null;
    if (removed) {
      if (typeof removed === 'string') {
        try { removed = JSON.parse(removed); } catch (e) { removed = removed.split(',').map(s => s.trim()).filter(Boolean); }
      }
      if (Array.isArray(removed) && removed.length) {
        // attempt remote deletion when publicId exists
        const { destroyFile } = require('../helpers/cloudinary');
        for (const r of removed) {
          const match = offer.files.find(f => f.urlSrc === r || f.url === r || f.filename === r || f.originalname === r);
          if (match && match.publicId) {
            try { await destroyFile(match.publicId); } catch (e) { /* ignore */ }
          }
        }
        offer.files = offer.files.filter(f => !removed.includes(f.urlSrc) && !removed.includes(f.url) && !removed.includes(f.filename) && !removed.includes(f.originalname));
      }
    }

    // Accept newly attached files metadata in `data.files` (uploaded separately)
    let newFiles = [];
    if (data.files) {
      try { newFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files; } catch (e) { newFiles = data.files; }
    }
    // handle localized proposalText update
    if (data.proposalText) {
      try { data.proposalText = await ensureLocalized(data.proposalText); } catch (e) { /* leave as-is */ }
    }
    if (Array.isArray(newFiles) && newFiles.length) {
      for (const fdoc of newFiles) {
        offer.files.push(fdoc);
      }
    }

    // apply other updates
    Object.keys(data).forEach(k => { if (!['removedFiles','removed','files'].includes(k)) offer[k] = data[k]; });
    await offer.save();
    return res.json({ offer });
  } catch (e) {
    console.error('updateOffer', e);
    return res.status(500).json({ error: 'Failed to update offer' });
  }
};

const withdrawOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ error: 'Not found' });
    if (String(offer.userId) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    offer.status = 'withdrawn';
    await offer.save();
    return res.json({ offer });
  } catch (e) {
    console.error('withdrawOffer', e);
    return res.status(500).json({ error: 'Failed to withdraw offer' });
  }
};

const acceptOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ error: 'Not found' });
    // Only listing/request owner can accept - check ownership
    if (offer.listingId) {
      const listing = await Listing.findById(offer.listingId);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });
      if (String(listing.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    }
    if (offer.requestId) {
      const request = await Request.findById(offer.requestId);
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (String(request.createdBy) !== String(req.user?.id)) return res.status(403).json({ error: 'Not allowed' });
    }
      offer.status = 'accepted';
      await offer.save();
      // mark the listing/request as awarded
      if (offer.listingId) {
        await Listing.findByIdAndUpdate(offer.listingId, { status: 'awarded', awardedOffer: offer._id, awardedAt: new Date() });
      }
      if (offer.requestId) {
        await Request.findByIdAndUpdate(offer.requestId, { status: 'awarded', awardedOffer: offer._id, awardedAt: new Date() });
      }
    return res.json({ offer });
  } catch (e) {
    console.error('acceptOffer', e);
    return res.status(500).json({ error: 'Failed to accept offer' });
  }
};

const completeOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ error: 'Not found' });
    // either party might mark as complete, depending on workflow; allow owner or offerer
    offer.status = 'completed';
    await offer.save();
    return res.json({ offer });
  } catch (e) {
    console.error('completeOffer', e);
    return res.status(500).json({ error: 'Failed to complete offer' });
  }
};

// List offers for a listing or request, splitting latest 3 as 'new'
const listOffers = async (req, res) => {
  try {
    const { listingId, requestId } = req.query;
    if (!listingId && !requestId) return res.status(400).json({ error: 'listingId or requestId required' });
    const q = {};
    if (listingId) q.listingId = listingId;
    if (requestId) q.requestId = requestId;
    const all = await Offer.find(q).sort({ createdAt: -1 }).limit(100).lean();
    const newOffers = all.slice(0,3).map(o => ({ ...o, timeAgo: timeAgo(o.createdAt) }));
    const offers = all.slice(3).map(o => ({ ...o, timeAgo: timeAgo(o.createdAt) }));
    return res.json({ new: newOffers, offers });
  } catch (e) {
    console.error('listOffers', e);
    return res.status(500).json({ error: 'Failed to list offers' });
  }
};

module.exports = { createOffer, updateOffer, withdrawOffer, acceptOffer, completeOffer, listOffers };
