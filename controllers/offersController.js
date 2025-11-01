const Offer = require('../models/Offer');
const Listing = require('../models/Listing');
const Request = require('../models/Request');
const timeAgo = require('../helpers/timeAgo');

const createOffer = async (req, res) => {
  try {
    const { listingId, requestId, price, proposalText } = req.body;
    if (!listingId && !requestId) return res.status(400).json({ error: 'listingId or requestId required' });
    if (!price) return res.status(400).json({ error: 'price required' });

    const offer = await Offer.create({ listingId, requestId, userId: req.user?.id, price: Number(price), proposalText });
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
    Object.assign(offer, req.body);
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
