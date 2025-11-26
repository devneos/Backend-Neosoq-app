const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const { buildFilter } = require('../../utils/filtering');
const { parsePagination } = require('../../utils/pagination');

const listTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, ['status', 'type', 'paymentMethod', 'userId']);

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    // populate basic user info
    const userIds = items.map(i => i.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email').lean();
    const usersById = users.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const rows = items.map(item => ({
      ...item,
      user: usersById[item.userId] || null,
    }));

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
};

const getTransactionDetails = async (req, res, next) => {
  try {
    const tx = await Transaction.findById(req.params.id).lean();
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    const user = await User.findById(tx.userId).select('firstName lastName email').lean();
    res.json({ ...tx, user });
  } catch (err) {
    next(err);
  }
};

const getSummaryCards = async (req, res, next) => {
  try {
    const match = {}; // could extend with date range
    const totalTx = await Transaction.countDocuments(match);
    const totalRevenue = await Transaction.aggregate([
      { $match: { ...match, type: 'credit', status: 'completed' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);
    const failedCount = await Transaction.countDocuments({ ...match, status: 'failed' });
    const pendingEscrow = await Transaction.aggregate([
      { $match: { ...match, status: 'pending' } },
      { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    res.json({
      totalTransactions: totalTx,
      totalRevenue: (totalRevenue[0] && totalRevenue[0].sum) || 0,
      failedTransactions: failedCount,
      pendingAmount: (pendingEscrow[0] && pendingEscrow[0].sum) || 0,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTransactions, getTransactionDetails, getSummaryCards };
