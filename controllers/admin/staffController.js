const User = require('../../models/User');
const { parsePagination } = require('../../utils/pagination');

exports.listStaff = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    const { skip, limit } = parsePagination(req.query);
    const filter = { roles: { $in: ['admin','moderator','support'] } };
    if (role) filter.roles = role;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];

    const total = await User.countDocuments(filter);
    const data = await User.find(filter).skip(skip).limit(limit).select('-password').sort({ createdAt: -1 });
    res.json({ data, meta: { total, limit, page: Math.floor(skip / limit) + 1 } });
  } catch (err) { next(err); }
};

exports.updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    delete payload.password; // don't allow password change here
    const user = await User.findByIdAndUpdate(id, payload, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json({ data: user });
  } catch (err) { next(err); }
};

exports.suspendStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { suspend = true, reason } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    user.suspended = suspend;
    if (reason) user.suspendReason = reason;
    await user.save();
    res.json({ data: { id: user._id, suspended: user.suspended } });
  } catch (err) { next(err); }
};

exports.removeStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    // soft delete: mark as removed and remove admin roles
    user.removed = true;
    user.roles = [];
    await user.save();
    res.json({ data: { id: user._id, removed: true } });
  } catch (err) { next(err); }
};
