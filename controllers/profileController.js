const User = require('../models/User');
const { ensureLocalized } = require('../helpers/translate');

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

module.exports = { editProfile };
