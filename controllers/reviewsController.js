const Review = require('../models/Review');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create review and update user's aggregate rating
const createReview = async (req, res) => {
  try {
    const { reviewedUserId, rating, text } = req.body;
    if (!reviewedUserId || !rating) return res.status(400).json({ error: 'reviewedUserId and rating required' });
    const { ensureLocalized } = require('../helpers/translate');
    let localizedText = undefined;
    if (text) localizedText = await ensureLocalized(text);
    const review = await Review.create({ reviewerId: req.user?.id, reviewedUserId, rating: Number(rating), text: localizedText });
    // Recalculate avg rating
    const ObjectId = mongoose.Types.ObjectId;
    const agg = await Review.aggregate([
      { $match: { reviewedUserId: new ObjectId(reviewedUserId) } },
      { $group: { _id: '$reviewedUserId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (agg && agg[0]) {
      await User.findByIdAndUpdate(reviewedUserId, { rating: agg[0].avg, ratingCount: agg[0].count });
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
