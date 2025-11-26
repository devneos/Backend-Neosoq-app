const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { buildFilter } = require('../../utils/filtering');
const { paginateArray } = require('../../utils/pagination');

exports.getSummaryUsers = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ active: false });

    // recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email createdAt active');

    // basic revenue from transactions grouped by users (top 5)
    const revenueAgg = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$userId', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    res.json({ totalUsers, bannedUsers, recentUsers, topPayers: revenueAgg });
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const allowed = ['email', 'username', 'role', 'active'];
    const filter = buildFilter(req.query, allowed);

    // Support both page/limit and skip/limit
    let limit = parseInt(req.query.limit, 10) || 20;
    if (limit <= 0) limit = 20;

    let skip = 0;
    if (req.query.skip !== undefined) {
      skip = parseInt(req.query.skip, 10) || 0;
      if (skip < 0) skip = 0;
    } else if (req.query.page !== undefined) {
      const page = parseInt(req.query.page, 10) || 1;
      skip = (page - 1) * limit;
    }

    // Projection fields
    let projection = null;
    if (req.query.fields) {
      const fields = req.query.fields.split(',').map(f => f.trim()).filter(Boolean);
      if (fields.length) projection = fields.join(' ');
    }

    // Sorting
    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const dir = (req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
      sort = { [req.query.sortBy]: dir };
    }

    const total = await User.countDocuments(filter);

    const query = User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    if (projection) query.select(projection);
    else query.select('username email createdAt role active');

    const docs = await query.exec();

    const page = Math.floor(skip / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));

    res.json({ docs, total, page, pages, limit });
  } catch (err) {
    next(err);
  }
};

exports.banUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { ban = true } = req.body;

    // 'ban' maps to setting `active: false` so we keep the existing User schema
    const user = await User.findByIdAndUpdate(
      userId,
      { active: !ban },
      { new: true }
    ).select('username email active');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // send email to user about ban/unban if helper exists
    try {
      const { sendTemplateEmail } = require('../../helpers/auth');
      if (sendTemplateEmail) {
        const subject = ban ? 'Account banned' : 'Account unbanned';
        const html = `<p>Hi ${user.username || user.email},</p><p>Your account status changed: ${ban ? 'inactive' : 'active'}.</p>`;
        // best-effort, don't fail the request if email fails
        sendTemplateEmail(user.email, subject, html).catch(() => {});
      }
    } catch (e) {
      // ignore
    }

    res.json({ message: 'OK', user });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
