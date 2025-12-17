const ChatMessage = require('../../models/ChatMessage');
const Dispute = require('../../models/Dispute');
const AdminSetting = require('../../models/AdminSetting');
const User = require('../../models/User');

const percentChange = (current = 0, prev = 0) => {
  if (!prev) return current > 0 ? 100 : 0;
  return Number((((current - prev) / Math.abs(prev)) * 100).toFixed(2));
};

const parseRange = (req) => {
  const now = new Date();
  const range = (req.query.range || '30d').toLowerCase();

  if (req.query.start || req.query.end) {
    const start = req.query.start ? new Date(req.query.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end) : now;
    const spanMs = Math.max(1, end.getTime() - start.getTime());
    const prevEnd = new Date(start.getTime());
    const prevStart = new Date(start.getTime() - spanMs);
    return { start, end, prevStart, prevEnd };
  }

  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const end = now;
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, prevStart, prevEnd };
};

// Summary cards: total messages, flagged messages, active reports, urgent reports
const summary = async (req, res, next) => {
  try {
    const { start, end, prevStart, prevEnd } = parseRange(req);

    const countMessages = async (s, e) => {
      const match = { createdAt: { $gte: s, $lte: e } };
      const total = await ChatMessage.countDocuments(match);
      const flagged = await ChatMessage.countDocuments({ ...match, flagged: true });
      return { total, flagged };
    };

    const countReports = async (s, e) => {
      const match = { createdAt: { $gte: s, $lte: e } };
      const active = await Dispute.countDocuments({ ...match, status: 'open' });
      const urgent = await Dispute.countDocuments({ ...match, priority: 'urgent' });
      return { active, urgent };
    };

    const [currMsgs, prevMsgs, currReports, prevReports] = await Promise.all([
      countMessages(start, end),
      countMessages(prevStart, prevEnd),
      countReports(start, end),
      countReports(prevStart, prevEnd),
    ]);

    res.json({
      range: { start, end, prevStart, prevEnd },
      cards: {
        totalMessages: {
          value: currMsgs.total,
          changePct: percentChange(currMsgs.total, prevMsgs.total),
        },
        flaggedMessages: {
          value: currMsgs.flagged,
          changePct: percentChange(currMsgs.flagged, prevMsgs.flagged),
        },
        activeReports: {
          value: currReports.active,
          changePct: percentChange(currReports.active, prevReports.active),
        },
        urgentReports: {
          value: currReports.urgent,
          changePct: percentChange(currReports.urgent, prevReports.urgent),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// List messages with search/filter/pagination
const listMessages = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.start || req.query.end) {
      filters.createdAt = {};
      if (req.query.start) filters.createdAt.$gte = new Date(req.query.start);
      if (req.query.end) filters.createdAt.$lte = new Date(req.query.end);
    }

    const status = (req.query.status || 'all').toLowerCase();
    if (status === 'flagged') {
      filters.flagged = true;
    } else if (['clean', 'review', 'resolved'].includes(status)) {
      filters.moderationStatus = status;
    }

    const search = (req.query.search || '').trim();

    const query = ChatMessage.find(filters)
      .populate('sender', 'username email')
      .populate('to', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (search) {
      query.find({ body: { $regex: search, $options: 'i' } });
    }

    const [total, docs] = await Promise.all([
      ChatMessage.countDocuments(search ? { ...filters, body: { $regex: search, $options: 'i' } } : filters),
      query.lean(),
    ]);

    const mapped = docs.map((d) => ({
      _id: d._id,
      senderName: d.sender ? (d.sender.username || d.sender.email) : null,
      receiverName: d.to ? (d.to.username || d.to.email) : null,
      contentPreview: (d.body || '').slice(0, 120),
      createdAt: d.createdAt,
      status: d.moderationStatus || (d.flagged ? 'flagged' : 'clean'),
      flagged: !!d.flagged,
    }));

    res.json({ docs: mapped, page, limit, total });
  } catch (err) {
    next(err);
  }
};

const flagMessage = async (req, res, next) => {
  try {
    const msg = await ChatMessage.findByIdAndUpdate(
      req.params.id,
      { flagged: true, moderationStatus: 'flagged' },
      { new: true }
    ).populate('sender', 'username email').populate('to', 'username email');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: msg });
  } catch (err) { next(err); }
};

const unflagMessage = async (req, res, next) => {
  try {
    const msg = await ChatMessage.findByIdAndUpdate(
      req.params.id,
      { flagged: false, moderationStatus: 'resolved' },
      { new: true }
    ).populate('sender', 'username email').populate('to', 'username email');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: msg });
  } catch (err) { next(err); }
};

const deleteMessage = async (req, res, next) => {
  try {
    const result = await ChatMessage.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Message not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// Reports (from Disputes)
const listReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filters = {};
    const status = (req.query.status || 'all').toLowerCase();
    if (['open','resolved','rejected'].includes(status)) filters.status = status;
    const priority = (req.query.priority || 'all').toLowerCase();
    if (['urgent','normal'].includes(priority)) filters.priority = priority;

    const search = (req.query.search || '').trim();
    if (search) {
      // search by description or issueType
      filters.$or = [
        { issueType: { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
        { 'description.ar': { $regex: search, $options: 'i' } },
      ];
    }

    const [total, docs] = await Promise.all([
      Dispute.countDocuments(filters),
      Dispute.find(filters)
        .populate('createdBy', 'username email')
        .populate('accusedUser', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const mapped = docs.map((d) => ({
      _id: d._id,
      reporter: d.createdBy ? (d.createdBy.username || d.createdBy.email) : null,
      accused: d.accusedUser ? (d.accusedUser.username || d.accusedUser.email) : null,
      issueType: d.issueType,
      description: d.description?.en || '',
      priority: d.priority || 'normal',
      status: d.status,
      flagged: !!d.flagged,
      createdAt: d.createdAt,
    }));

    res.json({ docs: mapped, page, limit, total });
  } catch (err) { next(err); }
};

const updateReportStatus = async (req, res, next) => {
  try {
    const { status, priority, flagged } = req.body;
    const update = {};
    if (status && ['open','resolved','rejected'].includes(status)) update.status = status;
    if (priority && ['urgent','normal'].includes(priority)) update.priority = priority;
    if (flagged !== undefined) update.flagged = !!flagged;

    const report = await Dispute.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('createdBy', 'username email')
      .populate('accusedUser', 'username email');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json({ report });
  } catch (err) { next(err); }
};

// Settings
const getSettings = async (_req, res, next) => {
  try {
    const doc = await AdminSetting.findOne({ key: 'messagesSettings' });
    res.json({ settings: doc ? doc.value : {} });
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const value = req.body || {};
    const doc = await AdminSetting.findOneAndUpdate(
      { key: 'messagesSettings' },
      { value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ settings: doc.value });
  } catch (err) { next(err); }
};

module.exports = {
  summary,
  listMessages,
  flagMessage,
  unflagMessage,
  deleteMessage,
  listReports,
  updateReportStatus,
  getSettings,
  updateSettings,
};
