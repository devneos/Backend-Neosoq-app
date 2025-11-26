const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const ChatMessage = require('../../models/ChatMessage');
const { parsePagination } = require('../../utils/pagination');

function parseRange(query) {
  const preset = (query.range || query.preset || '30d').toString();
  const now = new Date();
  let start;
  if (query.start && query.end) {
    start = new Date(query.start);
    const end = new Date(query.end);
    return { start, end };
  }

  const mapping = { '7d': 7, '30d': 30, '3mo': 90, '6mo': 180, '1y': 365 };
  const days = mapping[preset] || 30;
  start = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  return { start, end: now, days };
}

const revenueTrend = async (req, res, next) => {
  try {
    const { start, end, days } = parseRange(req.query);
    const rangeDays = days || Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // group by day for short ranges, month for long ranges
    const byMonth = rangeDays > 90;
    const dateFormat = byMonth ? '%Y-%m' : '%Y-%m-%d';

    const pipeline = [
      { $match: { status: 'completed', amount: { $gt: 0 }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, revenue: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
      { $project: { period: '$_id', revenue: 1, _id: 0 } },
    ];

    const rows = await Transaction.aggregate(pipeline);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const monthlyTransactions = async (req, res, next) => {
  try {
    const months = Number(req.query.months) || 12;
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);

    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } },
    ];

    const rows = await Transaction.aggregate(pipeline);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const topPerformers = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const search = (req.query.search || '').trim();
    const { start, end } = parseRange(req.query);

    const match = { status: 'completed', amount: { $gt: 0 }, createdAt: { $gte: start, $lte: end } };
    // consider these transaction types as revenue for performers
    const revenueTypes = ['listing_purchase', 'request_payment', 'escrow_payment', 'credit'];
    match.type = { $in: revenueTypes };

    const pipeline = [
      { $match: match },
      { $group: { _id: '$userId', revenue: { $sum: '$amount' } } },
      { $sort: { revenue: -1 } },
      { $limit: limit * 3 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { userId: '$_id', revenue: 1, name: { $ifNull: ['$user.username', ''] }, img: '$user.profileImage', position: '$user.position', rating: { $ifNull: ['$user.rating', 0] } } },
    ];

    let rows = await Transaction.aggregate(pipeline);

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.position && r.position.toLowerCase().includes(q)));
    }

    rows = rows.slice(0, limit);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const dashboardCards = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // monthly revenue current and previous
    const curAgg = await Transaction.aggregate([
      { $match: { status: 'completed', amount: { $gt: 0 }, createdAt: { $gte: startOfMonth, $lte: now } } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);
    const prevAgg = await Transaction.aggregate([
      { $match: { status: 'completed', amount: { $gt: 0 }, createdAt: { $gte: prevStart, $lte: prevEnd } } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);
    const curRevenue = (curAgg[0] && curAgg[0].sum) || 0;
    const prevRevenue = (prevAgg[0] && prevAgg[0].sum) || 0;
    const revenuePct = prevRevenue === 0 ? null : ((curRevenue - prevRevenue) / Math.abs(prevRevenue)) * 100;

    // new users last month and previous month using ObjectId timestamp
    const lastMonthStart = prevStart;
    const lastMonthEnd = prevEnd;
    const thisMonthStart = startOfMonth;

    const newThisMonth = await User.countDocuments({ _id: { $gte: mongooseObjectIdFromDate(thisMonthStart) } });
    const newPrevMonth = await User.countDocuments({ _id: { $gte: mongooseObjectIdFromDate(prevStart), $lte: mongooseObjectIdFromDate(prevEnd) } });
    const newUsersPct = newPrevMonth === 0 ? null : ((newThisMonth - newPrevMonth) / Math.abs(newPrevMonth)) * 100;

    // lifetime transactions
    const lifetimeTx = await Transaction.countDocuments({});

    // average daily messages over last 30 days
    const days = 30;
    const msgStart = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const msgCountAgg = await ChatMessage.aggregate([
      { $match: { createdAt: { $gte: msgStart, $lte: now } } },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);
    const msgCount = (msgCountAgg[0] && msgCountAgg[0].count) || 0;
    const avgDailyMessages = Math.round((msgCount / days) * 100) / 100;

    res.json({
      monthlyRevenue: curRevenue,
      monthlyRevenuePct: revenuePct,
      newUsersThisMonth: newThisMonth,
      newUsersPct: newUsersPct,
      lifetimeTransactions: lifetimeTx,
      avgDailyMessages,
    });
  } catch (err) {
    next(err);
  }
};

const categoryDistribution = async (req, res, next) => {
  try {
    // accept optional date range via query (start, end) or preset
    const { start, end } = parseRange(req.query);
    const match = { createdAt: { $gte: start, $lte: end } };

    // aggregate listings by category
    const Listing = require('../../models/Listing');
    const pipeline = [
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
    ];

    const rows = await Listing.aggregate(pipeline);
    const total = rows.reduce((s, r) => s + (r.count || 0), 0);

    // ensure the requested categories appear and compute percentages
    const categories = ['Automotive', 'Electronics', 'Services', 'Furniture'];
    const map = {};
    rows.forEach(r => { map[r.category] = r.count; });

    const data = categories.map(c => ({ category: c, count: map[c] || 0, percent: total ? Math.round(((map[c] || 0) / total) * 10000) / 100 : 0 }));

    // other bucket for remaining categories
    const knownCount = data.reduce((s, d) => s + d.count, 0);
    const otherCount = total - knownCount;
    if (otherCount > 0) data.push({ category: 'Other', count: otherCount, percent: total ? Math.round((otherCount / total) * 10000) / 100 : 0 });

    res.json({ total, data });
  } catch (err) {
    next(err);
  }
};

// helper: create ObjectId from date for user queries
function mongooseObjectIdFromDate(d) {
  let hexSeconds = Math.floor(d.getTime() / 1000).toString(16);
  while (hexSeconds.length < 8) hexSeconds = '0' + hexSeconds;
  return new (require('mongoose').Types.ObjectId)(hexSeconds + '0000000000000000');
}

module.exports = { revenueTrend, monthlyTransactions, topPerformers, dashboardCards, categoryDistribution };
