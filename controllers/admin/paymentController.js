const Transaction = require('../../models/Transaction');
const Wallet = require('../../models/Wallet');
const WithdrawalRequest = require('../../models/WithdrawalRequest');
const Dispute = require('../../models/Dispute');
const User = require('../../models/User');
const { parsePagination } = require('../../utils/pagination');
const { buildFilter } = require('../../utils/filtering');

const listWalletTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, ['status', 'type', 'paymentMethod']);

    // support search by user name or phone
    if (req.query.search) {
      const q = req.query.search.trim();
      const users = await User.find({ $or: [{ username: new RegExp(q, 'i') }, { phoneNumber: new RegExp(q, 'i') }] }).select('_id').lean();
      const ids = users.map(u => u._id);
      if (ids.length) filter.userId = { $in: ids };
      else filter.userId = { $in: [] };
    }

    if (req.query.start || req.query.end) {
      const start = req.query.start ? new Date(req.query.start) : new Date(0);
      const end = req.query.end ? new Date(req.query.end) : new Date();
      filter.createdAt = { $gte: start, $lte: end };
    }

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    // attach basic user info
    const userIds = items.map(i => i.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('username phoneNumber profileImage').lean();
    const byId = users.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const rows = items.map(tx => ({ ...tx, user: byId[tx.userId] || null }));
    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
};

const listWithdrawalRequests = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, ['status', 'method']);

    if (req.query.search) {
      const q = req.query.search.trim();
      const users = await User.find({ $or: [{ username: new RegExp(q, 'i') }, { phoneNumber: new RegExp(q, 'i') }] }).select('_id').lean();
      const ids = users.map(u => u._id);
      if (ids.length) filter.userId = { $in: ids };
      else filter.userId = { $in: [] };
    }

    const [items, total] = await Promise.all([
      WithdrawalRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WithdrawalRequest.countDocuments(filter),
    ]);

    const userIds = items.map(i => i.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('username phoneNumber profileImage').lean();
    const byId = users.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const rows = items.map(w => ({ ...w, user: byId[w.userId] || null }));
    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
};

const paymentSummary = async (req, res, next) => {
  try {
    // total wallet credits and pending (completed and pending)
    const creditsAgg = await Transaction.aggregate([
      { $match: { type: { $in: ['wallet_topup','credit','listing_purchase','request_payment','escrow_payment'] } , status: { $in: ['completed','pending'] } } },
      { $group: { _id: '$status', sum: { $sum: '$amount' } } }
    ]);
    const credits = creditsAgg.reduce((acc, r) => { acc[r._id] = r.sum; return acc; }, {});

    // combined wallet balances
    const balAgg = await Wallet.aggregate([
      { $group: { _id: null, totalAvailable: { $sum: '$available' }, totalLocked: { $sum: '$locked' } } }
    ]);
    const balances = balAgg[0] || { totalAvailable: 0, totalLocked: 0 };

    // pending withdrawal count + total amount
    const pendingWithdrawals = await WithdrawalRequest.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } }
    ]);
    const pw = pendingWithdrawals[0] || { count: 0, total: 0 };

    // active disputes
    const activeDisputes = await Dispute.countDocuments({ status: 'open' });

    res.json({
      totalWalletCredits: credits.completed || 0,
      pendingCredits: credits.pending || 0,
      combinedWalletAvailable: balances.totalAvailable || 0,
      combinedWalletLocked: balances.totalLocked || 0,
      pendingWithdrawalCount: pw.count || 0,
      pendingWithdrawalTotal: pw.total || 0,
      activeDisputes,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listWalletTransactions, listWithdrawalRequests, paymentSummary };
