const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Listing = require('../../models/Listing');
const Request = require('../../models/Request');
const Wallet = require('../../models/Wallet');
const { buildFilter } = require('../../utils/filtering');

const toPercent = (current = 0, previous = 0) => {
  if (!previous || Number.isNaN(previous)) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
};

exports.getSummaryUsers = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsersThisMonth,
      newUsersPrevMonth,
      ratingThisMonthAgg,
      ratingPrevMonthAgg,
      ratingOverallAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ active: true }),
      User.countDocuments({ active: false }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
      User.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
      User.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]),
    ]);

    const avgRatingCurrent =
      ratingThisMonthAgg[0]?.avgRating ?? ratingOverallAgg[0]?.avgRating ?? 0;
    const avgRatingPrev =
      ratingPrevMonthAgg[0]?.avgRating ?? ratingOverallAgg[0]?.avgRating ?? 0;

    const recentFilter = {};
    const recentStatus = (req.query.recentStatus || '').toLowerCase();
    if (recentStatus === 'active') recentFilter.active = true;
    if (recentStatus === 'suspended') recentFilter.active = false;
    const recentSearch = (req.query.recentSearch || '').trim();
    if (recentSearch) {
      recentFilter.$or = [
        { username: { $regex: recentSearch, $options: 'i' } },
        { name: { $regex: recentSearch, $options: 'i' } },
        { email: { $regex: recentSearch, $options: 'i' } },
        { phoneNumber: { $regex: recentSearch, $options: 'i' } },
      ];
    }
    const recentLimit = Math.min(Number(req.query.recentLimit) || 5, 20);
    const recentUsersRaw = await User.find(recentFilter)
      .sort({ createdAt: -1 })
      .limit(recentLimit)
      .select('username profileImage phoneNumber active createdAt email roles provider')
      .lean();
    const recentUsers = recentUsersRaw.map((user) => ({
      id: user._id,
      fullName: user.username || user.name,
      profileImage: user.profileImage || null,
      phoneNumber: user.phoneNumber || null,
      status: user.active ? 'active' : 'suspended',
      createdAt: user.createdAt,
      email: user.email || null,
      roles: user.roles || [],
      method: user.provider || (user.googleId ? 'google' : 'phone'),
    }));

    const topPayers = await Transaction.aggregate([
      { $match: { status: 'completed', userId: { $ne: null } } },
      { $group: { _id: '$userId', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          total: 1,
          user: {
            username: '$user.username',
            email: '$user.email',
            profileImage: '$user.profileImage',
          },
        },
      },
    ]);

    res.json({
      summary: {
        totalUsers: {
          value: totalUsers,
          monthlyChangePct: toPercent(newUsersThisMonth, newUsersPrevMonth),
        },
        activeUsers: { value: activeUsers },
        suspendedUsers: { value: suspendedUsers },
        avgMonthlyRating: {
          value: Number((avgRatingCurrent || 0).toFixed(2)),
          monthlyChangePct: toPercent(avgRatingCurrent, avgRatingPrev),
        },
      },
      recentUsers,
      topPayers,
    });
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const allowed = ['email', 'username', 'role', 'active'];
    const filter = buildFilter(req.query, allowed);
    const andClauses = [];

    const statusFilter = (req.query.status || '').toLowerCase();
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'active') filter.active = true;
      if (['suspended', 'closed'].includes(statusFilter)) filter.active = false;
    }

    const rolesFilter = (req.query.roles || req.query.role || '').trim();
    if (rolesFilter && rolesFilter !== 'all') {
      const rolesArray = rolesFilter
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      if (rolesArray.length) {
        filter.roles = { $in: rolesArray };
      }
    }

    const methodFilter = (req.query.method || req.query.methods || '').toLowerCase();
    if (methodFilter === 'google') {
      andClauses.push({ provider: 'google' });
    } else if (methodFilter === 'phone') {
      andClauses.push({
        $or: [
          { phoneNumber: { $exists: true, $ne: null } },
          { provider: { $in: ['phone', 'local'] } },
          { provider: { $exists: false } },
        ],
      });
    }

    const search = (req.query.search || '').trim();
    if (search) {
      andClauses.push({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (andClauses.length) {
      filter.$and = (filter.$and || []).concat(andClauses);
    }

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

    const baseFields = [
      'username',
      'name',
      'email',
      'phoneNumber',
      'profileImage',
      'roles',
      'provider',
      'googleId',
      'active',
      'createdAt',
      'position',
      'rating',
      'ratingCount',
      'country',
      'region',
      'sellerType',
      'followerCount',
      'followingCount',
    ];
    if (projection) {
      const extra = projection.split(/\s+/).filter(Boolean);
      const unique = Array.from(new Set([...baseFields, ...extra]));
      query.select(unique.join(' '));
    } else {
      query.select(baseFields.join(' '));
    }

    const docs = await query.exec();
    const userIds = docs.map(doc => doc._id);
    const [listingCountsAgg, requestCountsAgg, walletDocs] = await Promise.all([
      Listing.aggregate([
        { $match: { createdBy: { $in: userIds } } },
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
      ]),
      Request.aggregate([
        { $match: { createdBy: { $in: userIds } } },
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
      ]),
      Wallet.find({ userId: { $in: userIds } })
        .select('userId available locked')
        .lean(),
    ]);

    const listingCountMap = listingCountsAgg.reduce((acc, curr) => {
      acc[String(curr._id)] = curr.count;
      return acc;
    }, {});
    const requestCountMap = requestCountsAgg.reduce((acc, curr) => {
      acc[String(curr._id)] = curr.count;
      return acc;
    }, {});
    const walletMap = walletDocs.reduce((acc, curr) => {
      acc[String(curr.userId)] = curr;
      return acc;
    }, {});

    const enrichedDocs = docs.map(user => {
      const id = String(user._id);
      const contactValue = user.email || user.phoneNumber || null;
      const contactMethod = user.email ? 'email' : (user.phoneNumber ? 'phone' : null);
      const wallet = walletMap[id] || {};
      const numListings = listingCountMap[id] || 0;
      const numRequests = requestCountMap[id] || 0;
      const walletBalance = Number(wallet.available || 0);
      const walletLocked = Number(wallet.locked || 0);

      return {
        _id: user._id,
        username: user.username,
        email: user.email || null,
        phoneNumber: user.phoneNumber || null,
        active: user.active,
        status: user.active ? 'active' : 'suspended',
        joinedDate: user.createdAt,
        roles: user.roles || [],
        primaryRole: Array.isArray(user.roles) && user.roles.length ? user.roles[0] : null,
        contactMethod,
        contactValue,
        contactChannel: user.provider || (user.googleId ? 'google' : contactMethod),
        numListings,
        numRequests,
        walletBalance,
        walletLocked,
        walletTotal: walletBalance + walletLocked,
        rating: user.rating ?? 0,
        ratingCount: user.ratingCount ?? 0,
        occupation: user.position || '',
        profileImage: user.profileImage || null,
        country: user.country || null,
        region: user.region || null,
        followerCount: user.followerCount || 0,
        followingCount: user.followingCount || 0,
      };
    });

    const page = Math.floor(skip / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));

    res.json({ docs: enrichedDocs, total, page, pages, limit });
  } catch (err) {
    next(err);
  }
};

exports.banUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { ban = true, reason = '' } = req.body;
    const update = { active: !ban };
    if (reason) update.suspendReason = reason;

    // 'ban' maps to setting `active: false` so we keep the existing User schema
    const user = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true }
    ).select('username email active suspendReason');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // send email to user about ban/unban if helper exists
    try {
      const { sendTemplateEmail } = require('../../helpers/auth');
      if (sendTemplateEmail) {
        const subject = ban ? 'Account banned' : 'Account unbanned';
        const reasonHtml = ban && reason ? `<p>Reason: ${reason}</p>` : '';
        const html = `<p>Hi ${user.username || user.email},</p><p>Your account status changed: ${ban ? 'inactive' : 'active'}.</p>${reasonHtml}`;
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
