const Review = require('../models/Review');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Request = require('../models/Request');
const mongoose = require('mongoose');

// Create review and update user/listing/request aggregate rating
const createReview = async (req, res) => {
  try {
    const { reviewedUserId, reviewedListingId, reviewedRequestId, rating, text } = req.body;
    if (!rating) return res.status(400).json({ error: 'rating required' });
    if (!reviewedUserId && !reviewedListingId && !reviewedRequestId) return res.status(400).json({ error: 'Must provide reviewedUserId, reviewedListingId, or reviewedRequestId' });
    const { ensureLocalized } = require('../helpers/translate');
    let localizedText = undefined;
    if (text) localizedText = await ensureLocalized(text);
    const review = await Review.create({ reviewerId: req.user?.id, reviewedUserId, reviewedListingId, reviewedRequestId, rating: Number(rating), text: localizedText });
    // Recalculate avg rating for user
    if (reviewedUserId) {
      const ObjectId = mongoose.Types.ObjectId;
      const agg = await Review.aggregate([
        { $match: { reviewedUserId: new ObjectId(reviewedUserId) } },
        { $group: { _id: '$reviewedUserId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      if (agg && agg[0]) {
        await User.findByIdAndUpdate(reviewedUserId, { rating: agg[0].avg, ratingCount: agg[0].count });
      }
      // Notify the reviewed user
      try {
        const { createNotification } = require('./notificationsController');
        await createNotification({ userId: reviewedUserId, actorId: req.user?.id, type: 'review_created', title: 'New review', body: `You received a new review (${rating} stars)`, link: `/users/${reviewedUserId}/reviews`, data: { reviewId: review._id } });
      } catch (notifyErr) {
        console.warn('Failed to create notification for review:', notifyErr && notifyErr.message ? notifyErr.message : notifyErr);
      }
    }
    // Recalculate avg rating for listing
    if (reviewedListingId) {
      const ObjectId = mongoose.Types.ObjectId;
      const agg = await Review.aggregate([
        { $match: { reviewedListingId: new ObjectId(reviewedListingId) } },
        { $group: { _id: '$reviewedListingId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      if (agg && agg[0]) {
        await Listing.findByIdAndUpdate(reviewedListingId, { rating: agg[0].avg, ratingCount: agg[0].count });
      }
    }
    // Recalculate avg rating for request
    if (reviewedRequestId) {
      const ObjectId = mongoose.Types.ObjectId;
      const agg = await Review.aggregate([
        { $match: { reviewedRequestId: new ObjectId(reviewedRequestId) } },
        { $group: { _id: '$reviewedRequestId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      if (agg && agg[0]) {
        await Request.findByIdAndUpdate(reviewedRequestId, { rating: agg[0].avg, ratingCount: agg[0].count });
      }
    }
    return res.status(201).json({ review });
  } catch (e) {
    console.error('createReview', e);
    return res.status(500).json({ error: 'Failed to create review' });
  }
};

const listReviewsForUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const reviews = await Review.find({ reviewedUserId: userId }).sort({ createdAt: -1 }).lean();
    return res.json({ reviews });
  } catch (e) {
    console.error('listReviewsForUser', e);
    return res.status(500).json({ error: 'Failed to list reviews' });
  }
};

module.exports = { createReview, listReviewsForUser };
