const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const Listing = require('../../models/Listing');
const Request = require('../../models/Request');
const Escrow = require('../../models/Escrow');
const { buildFilter } = require('../../utils/filtering');
const { parsePagination } = require('../../utils/pagination');

const PAYMENT_LABELS = {
  card: 'Card',
  knet: 'KNET',
  bank_transfer: 'Bank Transfer',
  wallet: 'Wallet',
  apple_pay: 'Apple Pay',
  myfatoorah: 'MyFatoorah',
  other: 'Other',
};

const toPercent = (current = 0, previous = 0) => {
  if (!previous || Number.isNaN(previous)) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
};

const applyEscrowFilter = (filter, value) => {
  if (value === 'has') filter['escrow.hasEscrow'] = true;
  if (value === 'funded') filter['escrow.escrowStatus'] = { $in: ['held', 'active'] };
  if (value === 'released') filter['escrow.escrowStatus'] = 'released';
  if (value === 'refunded') filter['escrow.escrowStatus'] = 'refunded';
};

const enrichItemName = (tx, listingMap, requestMap) => {
  if (tx.type === 'listing_purchase' && tx.relatedId && listingMap[String(tx.relatedId)]) {
    return listingMap[String(tx.relatedId)].title?.en || listingMap[String(tx.relatedId)].title;
  }
  if (tx.type === 'request_payment' && tx.relatedId && requestMap[String(tx.relatedId)]) {
    return requestMap[String(tx.relatedId)].title?.en || requestMap[String(tx.relatedId)].title;
  }
  if (tx.metadata && tx.metadata.itemName) return tx.metadata.itemName;
  return tx.description || tx.type;
};

const listTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, ['status', 'type', 'paymentMethod', 'userId']);

    const search = (req.query.search || '').trim();
    if (search) {
      const users = await User.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean();
      if (!users.length) {
        return res.json({ data: [], meta: { total: 0, page, limit } });
      }
      filter.userId = { $in: users.map(u => u._id) };
    }

    const escrowFilter = (req.query.escrow || '').toLowerCase();
    if (escrowFilter) applyEscrowFilter(filter, escrowFilter);

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    const userIds = items.map(i => i.userId).filter(Boolean);
    const listingIds = items
      .filter(i => i.type === 'listing_purchase' && i.relatedId)
      .map(i => i.relatedId);
    const requestIds = items
      .filter(i => i.type === 'request_payment' && i.relatedId)
      .map(i => i.relatedId);

    const [usersDocs, listings, requests] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('username email').lean(),
      Listing.find({ _id: { $in: listingIds } }).select('title').lean(),
      Request.find({ _id: { $in: requestIds } }).select('title').lean(),
    ]);

    const usersById = usersDocs.reduce((acc, u) => {
      acc[String(u._id)] = u;
      return acc;
    }, {});
    const listingsById = listings.reduce((acc, doc) => {
      acc[String(doc._id)] = doc;
      return acc;
    }, {});
    const requestsById = requests.reduce((acc, doc) => {
      acc[String(doc._id)] = doc;
      return acc;
    }, {});

    const rows = items.map(item => {
      const user = usersById[String(item.userId)] || null;
      const itemName = enrichItemName(item, listingsById, requestsById);
      return {
        _id: item._id,
        type: item.type,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        paymentMethod: item.paymentMethod,
        paymentMethodLabel: PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod || 'Other',
        status: item.status,
        escrow: item.escrow || { hasEscrow: false },
        user,
        itemName,
        createdAt: item.createdAt,
        txnId: item.txnId,
      };
    });

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
};

const getTransactionDetails = async (req, res, next) => {
  try {
    const tx = await Transaction.findById(req.params.id).lean();
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    const user = await User.findById(tx.userId).select('username email phoneNumber').lean();
    const listing =
      tx.type === 'listing_purchase' && tx.relatedId
        ? await Listing.findById(tx.relatedId).select('title').lean()
        : null;
    const request =
      tx.type === 'request_payment' && tx.relatedId
        ? await Request.findById(tx.relatedId).select('title').lean()
        : null;

    res.json({
      ...tx,
      user,
      itemName: listing?.title?.en || request?.title?.en || tx.metadata?.itemName || tx.description,
      paymentMethodLabel: PAYMENT_LABELS[tx.paymentMethod] || tx.paymentMethod || 'Other',
    });
  } catch (err) {
    next(err);
  }
};

const getSummaryCards = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [totalTx, revenueCurrentAgg, revenuePrevAgg, failedCount, escrowPendingAgg] = await Promise.all([
      Transaction.countDocuments({}),
      Transaction.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ status: 'failed' }),
      Escrow.aggregate([
        { $match: { status: { $in: ['held', 'active'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
    ]);

    const revenueCurrent = revenueCurrentAgg[0]?.sum || 0;
    const revenuePrev = revenuePrevAgg[0]?.sum || 0;
    const escrowPending = escrowPendingAgg[0]?.sum || 0;

    res.json({
      totalTransactions: totalTx,
      totalRevenue: {
        value: revenueCurrent,
        monthlyChangePct: toPercent(revenueCurrent, revenuePrev),
      },
      totalEscrowPending: escrowPending,
      failedTransactions: failedCount,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listTransactions, getTransactionDetails, getSummaryCards };
