const Notification = require('../models/Notification');

// helper to create notification (can be imported)
const createNotification = async ({ userId, actorId, type, title, body, link, data }) => {
  if (!userId) return null;
  return Notification.create({ userId, actorId, type, title, body, link, data });
};

const fetchNotifications = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const skip = (page - 1) * limit;
  const rows = await Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const total = await Notification.countDocuments({ userId });
  res.json({ notifications: rows, page, limit, total });
};

const markAllRead = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  res.json({ ok: true });
};

const clearAll = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  await Notification.deleteMany({ userId });
  res.json({ ok: true });
};

module.exports = { createNotification, fetchNotifications, markAllRead, clearAll };
