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
    const { search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) {
      q.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } }
      ];
    }

    const docs = await Listing.find(q).sort({ createdAt: -1 }).lean();
    const out = docs.map(l => ({ ...l, title: l.title || { en: '', ar: '' }, description: l.description || { en: '', ar: '' }, timeAgo: timeAgo(l.createdAt), user }));
    return res.json({ user, listings: out });
  } catch (e) {
    console.error('getUserListings', e);
    return res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

const getUserOffers = async (req, res) => {
  try {
    const userId = req.params.id;
    const { search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { userId };
    if (search) {
      q.$or = [
        { 'proposalText.en': { $regex: search, $options: 'i' } },
        { 'proposalText.ar': { $regex: search, $options: 'i' } }
      ];
    }

    const docs = await Offer.find(q)
      .populate('listingId', 'title images price category')
      .populate('requestId', 'title description budget category')
      .sort({ createdAt: -1 })
      .lean();
    
    // Enrich with target, counterparty, and isAccepted
    const enriched = await Promise.all(docs.map(async (o) => {
      let target = null;
      let counterparty = null;
      
      // Get target (listing or request)
      if (o.listingId) {
        target = {
          type: 'listing',
          id: o.listingId._id,
          title: o.listingId.title,
          images: o.listingId.images,
          price: o.listingId.price,
          category: o.listingId.category
        };
        // Counterparty is listing owner
        const listing = await Listing.findById(o.listingId._id).populate('createdBy', 'username profileImage phoneNumber').lean();
        if (listing && listing.createdBy) {
          counterparty = {
            name: listing.createdBy.username,
            image: listing.createdBy.profileImage,
            phone: listing.createdBy.phoneNumber
          };
        }
      } else if (o.requestId) {
        target = {
          type: 'request',
          id: o.requestId._id,
          title: o.requestId.title,
          description: o.requestId.description,
          budget: o.requestId.budget,
          category: o.requestId.category
        };
        // Counterparty is request owner
        const request = await Request.findById(o.requestId._id).populate('createdBy', 'username profileImage phoneNumber').lean();
        if (request && request.createdBy) {
          counterparty = {
            name: request.createdBy.username,
            image: request.createdBy.profileImage,
            phone: request.createdBy.phoneNumber
          };
        }
      }

      return {
        ...o,
        target,
        counterparty,
        isAccepted: o.status === 'accepted',
        timeAgo: timeAgo(o.createdAt),
        quantity: o.quantity === 0 ? null : o.quantity,
        user
      };
    }));

    return res.json({ user, offers: enriched });
  } catch (e) {
    console.error('getUserOffers', e);
    return res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const userId = req.params.id;
    const { search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) q['message.en'] = { $regex: search, $options: 'i' };

    const docs = await Post.find(q).sort({ createdAt: -1 }).lean();
    const out = docs.map(p => ({ ...p, message: p.message || { en: '', ar: '' }, timeAgo: timeAgo(p.createdAt), user }));
    return res.json({ user, posts: out });
  } catch (e) {
    console.error('getUserPosts', e);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

const getUserRequests = async (req, res) => {
  try {
    const userId = req.params.id;
    const { search } = req.query;
    const user = await fetchUserProfile(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = { createdBy: userId };
    if (search) q['title.en'] = { $regex: search, $options: 'i' };

    const docs = await Request.find(q).sort({ createdAt: -1 }).lean();
    const out = docs.map(r => ({ ...r, title: r.title || { en: '', ar: '' }, description: r.description || { en: '', ar: '' }, timeAgo: timeAgo(r.createdAt), user }));
    return res.json({ user, requests: out });
  } catch (e) {
    console.error('getUserRequests', e);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

module.exports = { getUserListings, getUserOffers, getUserPosts, getUserRequests };
