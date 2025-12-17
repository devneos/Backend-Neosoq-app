const SavedItem = require('../models/SavedItem');

const addSavedItem = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { itemType, itemId, meta } = req.body;
  if (!itemType || !['listing','request','post'].includes(itemType)) return res.status(400).json({ message: 'Invalid itemType' });
  if (!itemId) return res.status(400).json({ message: 'itemId required' });
  try {
    const doc = await SavedItem.findOneAndUpdate({ userId, itemType, itemId }, { $setOnInsert: { userId, itemType, itemId, meta } }, { upsert: true, new: true });
    res.status(201).json({ saved: doc });
  } catch (err) {
    if (err && err.code === 11000) return res.json({ ok: true });
    throw err;
  }
};

const removeSavedItem = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const { id } = req.params; // saved item id
  await SavedItem.findOneAndDelete({ _id: id, userId });
  res.json({ ok: true });
};

const fetchSaved = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const skip = (page - 1) * limit;
  const rows = await SavedItem.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const total = await SavedItem.countDocuments({ userId });
  
  // Embed full item data for each saved item
  const Listing = require('../models/Listing');
  const Request = require('../models/Request');
  const Post = require('../models/Post');
  
  const enriched = await Promise.all(rows.map(async (saved) => {
    let item = null;
    try {
      if (saved.itemType === 'listing') {
        item = await Listing.findById(saved.itemId).lean();
      } else if (saved.itemType === 'request') {
        item = await Request.findById(saved.itemId).lean();
      } else if (saved.itemType === 'post') {
        item = await Post.findById(saved.itemId).lean();
      }
    } catch (e) {
      // Item may have been deleted
    }
    return { ...saved, item };
  }));
  
  res.json({ saved: enriched, page, limit, total });
};

module.exports = { addSavedItem, removeSavedItem, fetchSaved };
