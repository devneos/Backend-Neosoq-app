const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Request = require('../../models/Request');
const { buildFilter } = require('../../utils/filtering');

// GET /admin/dashboard/summary
async function getSummary(req, res) {
  try {
    const [usersCount, listingsCount, requestsCount] = await Promise.all([
      User.countDocuments({}),
      Listing.countDocuments({}),
      Request.countDocuments({}),
    ]);

    // Total revenue from completed transactions
    const revenueAgg = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const revenue = (revenueAgg[0] && revenueAgg[0].total) || 0;
    const transactionsCount = (revenueAgg[0] && revenueAgg[0].count) || 0;

    const recentTransactions = await Transaction.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      usersCount,
      listingsCount,
      requestsCount,
      revenue,
      transactionsCount,
      recentTransactions,
    });
  } catch (err) {
    console.error('admin dashboard summary error:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

// GET /admin/dashboard/transactions
async function listTransactions(req, res) {
  try {
    const { page = 1, limit = 20, ...q } = req.query;
    const allowed = ['status', 'paymentMethod', 'type', 'userId'];
    const filter = buildFilter(q, allowed);

    const p = Number(page) || 1;
    const l = Math.max(1, Number(limit) || 20);

    const total = await Transaction.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / l));

    const docs = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    res.json({ docs, total, page: p, pages, limit: l });
  } catch (err) {
    console.error('admin transactions list error:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { getSummary, listTransactions };
