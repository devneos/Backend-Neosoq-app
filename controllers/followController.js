const Follow = require('../models/Follow');
const User = require('../models/User');

// Follow a user
const followUser = async (req, res) => {
  const followerId = req.user && req.user.id;
  const followingId = req.params.userId;
  if (!followerId) return res.status(401).json({ message: 'Unauthorized' });
  if (followerId === followingId) return res.status(400).json({ message: 'Cannot follow yourself' });

  // If already following, no-op
  const exists = await Follow.findOne({ follower: followerId, following: followingId });
  if (exists) return res.json({ ok: true });

  try {
    await Follow.create({ follower: followerId, following: followingId });
    // Increment counts only when a new follow was created
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(followingId, { $inc: { followerCount: 1 } });
    res.json({ ok: true });
  } catch (err) {
    // If duplicate key due to race, treat as success
    if (err && err.code === 11000) return res.json({ ok: true });
    throw err;
  }
};

// Unfollow
const unfollowUser = async (req, res) => {
  const followerId = req.user && req.user.id;
  const followingId = req.params.userId;
  if (!followerId) return res.status(401).json({ message: 'Unauthorized' });
  const removed = await Follow.findOneAndDelete({ follower: followerId, following: followingId });
  if (removed) {
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(followingId, { $inc: { followerCount: -1 } });
  }
  res.json({ ok: true });
};

// Remove a follower (current user removes someone who follows them)
const removeFollower = async (req, res) => {
  const currentUserId = req.user && req.user.id;
  const followerId = req.params.userId; // the follower to remove
  if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });
  if (currentUserId === followerId) return res.status(400).json({ message: 'Invalid operation' });
  const removed = await Follow.findOneAndDelete({ follower: followerId, following: currentUserId });
  if (removed) {
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    await User.findByIdAndUpdate(currentUserId, { $inc: { followerCount: -1 } });
  }
  res.json({ ok: true });
};

// Get followers for a user
const getFollowers = async (req, res) => {
  const userId = req.params.userId || req.user && req.user.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const skip = (page - 1) * limit;
  const rows = await Follow.find({ following: userId }).skip(skip).limit(limit).populate('follower', 'username profileImage');
  res.json({ followers: rows, page, limit });
};

// Get following list for a user
const getFollowing = async (req, res) => {
  const userId = req.params.userId || req.user && req.user.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const skip = (page - 1) * limit;
  const rows = await Follow.find({ follower: userId }).skip(skip).limit(limit).populate('following', 'username profileImage');
  res.json({ following: rows, page, limit });
};

module.exports = { followUser, unfollowUser, removeFollower, getFollowers, getFollowing };
