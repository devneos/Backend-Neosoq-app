const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Post = require('../models/Post');
const Request = require('../models/Request');
const User = require('../models/User');
const timeAgo = require('../helpers/timeAgo');

// Return minimal user profile for frontend use
const fetchUserProfile = async (userId) => {
  const u = await User.findById(userId).select('username profileImage roles position country region rating ratingCount sellerType followerCount followingCount').lean();
  if (!u) return null;
  return {
    id: u._id,
    username: u.username,
    profileImage: u.profileImage,
    roles: u.roles,
    position: u.position,
    country: u.country,
    region: u.region,
    rating: u.rating || 5.0,
    ratingCount: u.ratingCount || 0,
    sellerType: u.sellerType || 'seller'
    ,
    followerCount: u.followerCount || 0,
    followingCount: u.followingCount || 0
  };
};

const getUserListings = async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) {
      q.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await Listing.countDocuments(q);
    const docs = await Listing.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(l => ({ ...l, title: l.title || { en: '', ar: '' }, description: l.description || { en: '', ar: '' }, timeAgo: timeAgo(l.createdAt), user }));
    return res.json({ user, listings: out, page: Number(page), limit: Number(limit), totalCount });
  } catch (e) {
    console.error('getUserListings', e);
    return res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

const getUserOffers = async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { userId };
    if (search) {
      q.$or = [
        { 'proposalText.en': { $regex: search, $options: 'i' } },
        { 'proposalText.ar': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await Offer.countDocuments(q);
    const docs = await Offer.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(o => ({ ...o, timeAgo: timeAgo(o.createdAt), quantity: o.quantity === 0 ? null : o.quantity, user }));
    return res.json({ user, offers: out, page: Number(page), limit: Number(limit), totalCount });
  } catch (e) {
    console.error('getUserOffers', e);
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) q['message.en'] = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await Post.countDocuments(q);
    const docs = await Post.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(p => ({ ...p, message: p.message || { en: '', ar: '' }, timeAgo: timeAgo(p.createdAt), user }));
    return res.json({ user, posts: out, page: Number(page), limit: Number(limit), totalCount });
  } catch (e) {
    console.error('getUserPosts', e);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

const getUserRequests = async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) q['title.en'] = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const totalCount = await Request.countDocuments(q);
    const docs = await Request.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const out = docs.map(r => ({ ...r, title: r.title || { en: '', ar: '' }, description: r.description || { en: '', ar: '' }, timeAgo: timeAgo(r.createdAt), user }));
    return res.json({ user, requests: out, page: Number(page), limit: Number(limit), totalCount });
  } catch (e) {
    console.error('getUserRequests', e);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

module.exports = { getUserListings, getUserOffers, getUserPosts, getUserRequests };
