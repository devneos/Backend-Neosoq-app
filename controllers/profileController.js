const User = require('../models/User');
const Follow = require('../models/Follow');
const { ensureLocalized } = require('../helpers/translate');

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (e) {
    console.error('getMyProfile', e);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user?.id;
    const user = await User.findById(targetUserId).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Check if current user follows this user
    let isFollowedByMe = false;
    let followId = null;
    if (currentUserId) {
      const follow = await Follow.findOne({ followerId: currentUserId, followedUserId: targetUserId }).lean();
      if (follow) {
        isFollowedByMe = true;
        followId = follow._id;
      }
    }
    return res.json({ user: { ...user, isFollowedByMe, followId } });
  } catch (e) {
    console.error('getUserProfile', e);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

const editProfile = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = {};
  const { name, photo, phone, address, email, role, bio } = req.body;
  if (name !== undefined) payload.username = name; // keeping username field for backward compatibility
  if (photo !== undefined) payload.profileImage = photo;
  if (phone !== undefined) payload.phoneNumber = phone;
  if (address !== undefined) payload.address = address;
  if (email !== undefined) payload.email = email;
  if (role !== undefined) payload.roles = Array.isArray(role) ? role : [role];
  if (bio !== undefined) payload.bio = bio;

  const updated = await User.findByIdAndUpdate(userId, payload, { new: true }).select('-password');
  res.json({ user: updated });
};

module.exports = { getMyProfile, getUserProfile, editProfile };
