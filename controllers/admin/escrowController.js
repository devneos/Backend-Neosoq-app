const Escrow = require('../../models/Escrow');
const Ledger = require('../../models/Ledger');
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

    // Basic user info populate for payer/recipient
    const userIds = [];
    items.forEach(i => { if (i.payerId) userIds.push(i.payerId); if (i.recipientId) userIds.push(i.recipientId); if (i.buyerId) userIds.push(i.buyerId); if (i.workerId) userIds.push(i.workerId); });
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email username').lean();
    const usersById = users.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const rows = items.map(item => ({
      ...item,
      payer: usersById[item.payerId] || usersById[item.buyerId] || null,
      recipient: usersById[item.recipientId] || usersById[item.workerId] || null,
    }));

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

    // include user info
    const payer = escrow.payerId ? await User.findById(escrow.payerId).select('firstName lastName email username').lean() : (escrow.buyerId ? await User.findById(escrow.buyerId).select('firstName lastName email username').lean() : null);
    const recipient = escrow.recipientId ? await User.findById(escrow.recipientId).select('firstName lastName email username').lean() : (escrow.workerId ? await User.findById(escrow.workerId).select('firstName lastName email username').lean() : null);

    res.json({ escrow: { ...escrow, payer, recipient }, ledgers });
  } catch (err) {
    next(err);
  }
};

// Reuse existing admin methods implemented in main escrow controller
const { adminForceRelease, adminForceRefund } = require('../escrowController');

module.exports = { listEscrows, getEscrowDetails, adminForceRelease, adminForceRefund };
