const User = require('../models/User');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Post = require('../models/Post');
const Request = require('../models/Request');
const Follow = require('../models/Follow');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const SavedItem = require('../models/SavedItem');
const Notification = require('../models/Notification');
const Wallet = require('../models/Wallet');
const PromotionPurchase = require('../models/PromotionPurchase');
const Transaction = require('../models/Transaction');
const IdempotencyKey = require('../models/IdempotencyKey');
const { destroyFile } = require('../helpers/cloudinary');

// Permanently close account and remove related user data
const closeAccount = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  // Delete remote files stored in cloudinary for user's content, then delete documents
  try {
    // Listings
    const listings = await Listing.find({ createdBy: userId }).lean();
    for (const l of listings) {
      if (Array.isArray(l.files)) {
        for (const f of l.files) {
          if (f && (f.publicId || f.public_id)) {
            try { await destroyFile(f.publicId || f.public_id); } catch (e) { /* ignore */ }
          }
        }
      }
    }
    await Listing.deleteMany({ createdBy: userId });

    // Offers
    const offers = await Offer.find({ userId }).lean();
    for (const o of offers) {
      if (Array.isArray(o.files)) {
        for (const f of o.files) {
          if (f && (f.publicId || f.public_id)) {
            try { await destroyFile(f.publicId || f.public_id); } catch (e) { }
          }
        }
      }
    }
    await Offer.deleteMany({ userId });

    // Posts
    const posts = await Post.find({ createdBy: userId }).lean();
    for (const p of posts) {
      if (Array.isArray(p.files)) {
        for (const f of p.files) {
          if (f && (f.publicId || f.public_id)) {
            try { await destroyFile(f.publicId || f.public_id); } catch (e) { }
          }
        }
      }
    }
    await Post.deleteMany({ createdBy: userId });

    // Requests
    const requests = await Request.find({ createdBy: userId }).lean();
    for (const r of requests) {
      if (Array.isArray(r.files)) {
        for (const f of r.files) {
          if (f && (f.publicId || f.public_id)) {
            try { await destroyFile(f.publicId || f.public_id); } catch (e) { }
          }
        }
      }
    }
    await Request.deleteMany({ createdBy: userId });
  } catch (e) {
    console.warn('closeAccount: file deletion error', e && e.message);
  }

  // Remove follows where user is follower or following
  await Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] });

  // Remove conversations the user participates in and their messages
  const convs = await Conversation.find({ participants: userId }).select('_id').lean();
  const convIds = convs.map(c => c._id);
  if (convIds.length) {
    await ChatMessage.deleteMany({ conversationId: { $in: convIds } });
    await Conversation.deleteMany({ _id: { $in: convIds } });
  }

  // Remove saved items, notifications, wallet, promotion purchases, transactions, idempotency keys
  try {
    await SavedItem.deleteMany({ userId });
    await Notification.deleteMany({ userId });
    await Wallet.deleteMany({ userId });
    await PromotionPurchase.deleteMany({ user: userId });
    await Transaction.deleteMany({ userId });
    await IdempotencyKey.deleteMany({ 'request.userId': userId });
  } catch (e) { /* ignore */ }

  // Finally delete the user
  await User.findByIdAndDelete(userId);
  res.json({ ok: true });
};

module.exports = { closeAccount };
