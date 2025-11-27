const Escrow = require('../../models/Escrow');
const Ledger = require('../../models/Ledger');
const Listing = require('../../models/Listing');
const Request = require('../../models/Request');
const User = require('../../models/User');
const { buildFilter } = require('../../utils/filtering');
const { parsePagination } = require('../../utils/pagination');

const listEscrows = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = buildFilter(req.query, ['status', 'type']);

    const [items, total] = await Promise.all([
      Escrow.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Escrow.countDocuments(filter),
    ]);

    const userIds = [];
    const listingIds = [];
    const requestIds = [];
    items.forEach(i => {
      if (i.payerId) userIds.push(i.payerId);
      if (i.recipientId) userIds.push(i.recipientId);
      if (i.buyerId) userIds.push(i.buyerId);
      if (i.workerId) userIds.push(i.workerId);
      if (i.listingId) listingIds.push(i.listingId);
      if (i.requestId) requestIds.push(i.requestId);
    });

    const [users, listings, requests] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('username email').lean(),
      Listing.find({ _id: { $in: listingIds } }).select('title').lean(),
      Request.find({ _id: { $in: requestIds } }).select('title').lean(),
    ]);

    const usersById = users.reduce((acc, u) => {
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
      const payer = usersById[String(item.payerId)] || usersById[String(item.buyerId)] || null;
      const recipient =
        usersById[String(item.recipientId)] || usersById[String(item.workerId)] || null;
      const listingTitle = item.listingId ? listingsById[String(item.listingId)]?.title?.en : null;
      const requestTitle = item.requestId ? requestsById[String(item.requestId)]?.title?.en : null;
      const itemName = item.itemName || listingTitle || requestTitle || 'Escrow';

      return {
        _id: item._id,
        type: item.type || (item.listingId ? 'listing' : item.requestId ? 'request' : 'other'),
        itemName,
        amount: item.amount,
        paymentMethod: item.paymentMethod,
        status: item.status,
        timestamp: item.createdAt,
        payer,
        recipient,
      };
    });

    res.json({ data: rows, meta: { total, page, limit } });
  } catch (err) {
    next(err);
  }
};

const getEscrowDetails = async (req, res, next) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id).lean();
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
    const ledgers = await Ledger.find({ referenceId: id }).sort({ createdAt: -1 }).lean();

    const payer = escrow.payerId
      ? await User.findById(escrow.payerId).select('username email').lean()
      : escrow.buyerId
      ? await User.findById(escrow.buyerId).select('username email').lean()
      : null;
    const recipient = escrow.recipientId
      ? await User.findById(escrow.recipientId).select('username email').lean()
      : escrow.workerId
      ? await User.findById(escrow.workerId).select('username email').lean()
      : null;

    const listing = escrow.listingId
      ? await Listing.findById(escrow.listingId).select('title').lean()
      : null;
    const request = escrow.requestId
      ? await Request.findById(escrow.requestId).select('title').lean()
      : null;

    res.json({
      escrow: {
        ...escrow,
        payer,
        recipient,
        itemName: escrow.itemName || listing?.title?.en || request?.title?.en || 'Escrow',
        releaseHistory: escrow.releaseHistory || [],
      },
      ledgers,
    });
  } catch (err) {
    next(err);
  }
};

const { adminForceRelease, adminForceRefund } = require('../escrowController');

module.exports = { listEscrows, getEscrowDetails, adminForceRelease, adminForceRefund };
