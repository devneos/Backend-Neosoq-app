const Listing = require('../models/Listing');
const Request = require('../models/Request');
const Post = require('../models/Post');
const timeAgo = require('../helpers/timeAgo');

// GET /feed?page=1&limit=20
const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Number(limit));
    const skip = (p - 1) * l;

    // Fetch items concurrently but limited to (skip + limit) each to allow merging
    // We'll fetch a bit more from each collection to ensure page fill; a simple approach
    // is to fetch skip+limit from each and then merge/sort and slice.
    const take = skip + l;
    const [listings, requests, posts] = await Promise.all([
      Listing.find({}).sort({ createdAt: -1 }).limit(take).lean(),
      Request.find({}).sort({ createdAt: -1 }).limit(take).lean(),
      Post.find({}).sort({ createdAt: -1 }).limit(take).lean(),
    ]);

    // Compute totals across collections so frontend can show pagination info
    const [listCount, reqCount, postCount] = await Promise.all([
      Listing.countDocuments(),
      Request.countDocuments(),
      Post.countDocuments(),
    ]);
    const totalCount = (Number(listCount) || 0) + (Number(reqCount) || 0) + (Number(postCount) || 0);
    const totalPages = Math.ceil(totalCount / l);

    // Normalize items with a type field and unified fields expected by frontend
    const norm = [];
    for (const li of listings) norm.push({ type: 'listing', id: li._id, createdAt: li.createdAt, payload: li, timeAgo: timeAgo(li.createdAt) });
    for (const r of requests) norm.push({ type: 'request', id: r._id, createdAt: r.createdAt, payload: r, timeAgo: timeAgo(r.createdAt) });
    for (const pdoc of posts) norm.push({ type: 'post', id: pdoc._id, createdAt: pdoc.createdAt, payload: pdoc, timeAgo: timeAgo(pdoc.createdAt) });

    // Sort by createdAt desc
    norm.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate merged list
    const pageItems = norm.slice(skip, skip + l);

  // Return items with type and payload + pagination metadata
  return res.json({ items: pageItems, page: p, limit: l, totalCount, totalPages });
  } catch (e) {
    console.error('getFeed', e);
    return res.status(500).json({ error: 'Failed to fetch feed' });
  }
};

module.exports = { getFeed };
