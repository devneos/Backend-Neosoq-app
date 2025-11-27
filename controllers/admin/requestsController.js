const Request = require('../../models/Request');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const Escrow = require('../../models/Escrow');
const { buildFilter } = require('../../utils/filtering');
const { parsePagination } = require('../../utils/pagination');
const { buildPromotionSnapshots } = require('../../utils/promotionHelpers');

const buildSummary = async () => {
  const counts = await Request.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const map = counts.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});
  const total = (map.open || 0) + (map.closed || 0) + (map.awarded || 0);
  return {
    total,
    active: map.open || 0,
    completed: map.awarded || 0,
    pending: map.closed || 0,
  };
};

// GET /admin/requests
exports.listRequests = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const allowed = ['status', 'pricingType', 'isPromoted'];
    const filter = buildFilter(req.query, allowed);

    const search = (req.query.search || '').trim();
    if (search) {
      filter.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
      ];
    }

    const promotedFilter = req.query.promoted;
    if (promotedFilter === 'true') filter.isPromoted = true;
    if (promotedFilter === 'false') filter.isPromoted = false;

    const pipeline = [
      { $match: filter },
      { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'creator' } },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'offers', localField: '_id', foreignField: 'requestId', as: 'applications' } },
      {
        $addFields: {
          totalApplications: { $size: '$applications' },
          creatorName: '$creator.username',
          creatorAddress: '$creator.location.addressLine',
          creatorPhone: '$creator.phoneNumber',
        },
      },
      { $project: { applications: 0, description: 0 } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [rows, totalAgg, summary] = await Promise.all([
      Request.aggregate(pipeline).exec(),
      Request.aggregate([{ $match: filter }, { $count: 'total' }]),
      buildSummary(),
    ]);

    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    const pages = Math.max(1, Math.ceil(total / limit));

    const requestIds = rows.map(row => row._id);
    const userIds = rows.map(row => row.createdBy).filter(Boolean);

    const [escrowAgg, promotionMap] = await Promise.all([
      Escrow.aggregate([
        { $match: { requestId: { $in: requestIds }, status: { $in: ['held', 'active', 'released', 'completed'] } } },
        { $group: { _id: '$requestId', status: { $first: '$status' } } },
      ]),
      buildPromotionSnapshots(userIds),
    ]);

    const escrowMap = escrowAgg.reduce((acc, curr) => {
      acc[String(curr._id)] = curr.status;
      return acc;
    }, {});

    const docs = rows.map(request => {
      const userId = request.createdBy ? String(request.createdBy) : null;
      const promotion = userId ? promotionMap[userId] : null;
      const deadline = request.deadline || null;
      return {
        _id: request._id,
        title: request.title,
        promoted: request.isPromoted || !!promotion,
        escrowFunded: !!escrowMap[String(request._id)],
        creatorName: request.creatorName || null,
        creatorAddress: request.creatorAddress || null,
        creatorPhone: request.creatorPhone || null,
        createdAt: request.createdAt,
        pricingType: request.pricingType,
        status: request.status,
        totalApplications: request.totalApplications || 0,
        deadlineDate: deadline,
        promotion: promotion
          ? {
              planName: promotion.planName,
              tier: promotion.planName,
              remainingDays: promotion.remainingDays,
              status: promotion.status,
            }
          : null,
      };
    });

    res.json({ docs, total, page, pages, limit, summary });
  } catch (err) {
    next(err);
  }
};

// GET /admin/requests/:id
exports.getRequestDetails = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const owner = request.createdBy
      ? await User.findById(request.createdBy)
          .select('username email phoneNumber profileImage position location rating ratingCount provider')
          .lean()
      : null;

    const promotionMap = await buildPromotionSnapshots(owner ? [owner._id] : []);
    const promotion = owner ? promotionMap[String(owner._id)] : null;
    const escrow = await Escrow.findOne({ requestId: request._id })
      .sort({ createdAt: -1 })
      .select('status amount paymentMethod')
      .lean();

    const applicants = await Offer.find({ requestId: request._id }).sort({ createdAt: -1 }).lean();

    const userIds = applicants.map(a => a.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('username profileImage phoneNumber').lean();
    const usersMap = {};
    users.forEach(u => { usersMap[String(u._id)] = u; });

    const appsFormatted = applicants.map(a => ({
      id: a._id,
      name: usersMap[String(a.userId)]?.username || null,
      img: usersMap[String(a.userId)]?.profileImage || null,
      phone: usersMap[String(a.userId)]?.phoneNumber || null,
      bidAmount: a.price,
      completedTime: a.status === 'completed' ? a.updatedAt : null,
      applicationDate: a.createdAt,
      status: a.status,
      coverLetter: a.proposalText,
    }));

    res.json({
      request: {
        ...request,
        attachments: request.files || [],
        requester: owner
          ? {
              id: owner._id,
              name: owner.username,
              email: owner.email,
              phone: owner.phoneNumber,
              occupation: owner.position,
              location: owner.location || null,
              rating: owner.rating,
              ratingCount: owner.ratingCount,
              method: owner.provider || (owner.email ? 'email' : 'phone'),
            }
          : null,
        promotion: promotion
          ? {
              planName: promotion.planName,
              remainingDays: promotion.remainingDays,
              status: promotion.status,
            }
          : null,
        escrow: escrow
          ? {
              status: escrow.status,
              amount: escrow.amount,
              paymentMethod: escrow.paymentMethod,
            }
          : null,
      },
      applicants: appsFormatted,
    });
  } catch (err) {
    next(err);
  }
};

// POST /admin/requests/:id/approve
exports.approveRequest = async (req, res, next) => {
  try {
    const request = await Request.findByIdAndUpdate(req.params.id, { status: 'awarded' }, { new: true }).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // notify requester
    try {
      const owner = await User.findById(request.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your request was approved', `<p>Hi ${owner.username || ''}, your request "${request.title?.en || request._id}" has been approved.</p>`).catch(() => {});
      }
    } catch (e) {}
    // in-app notification
    try {
      const { createNotification } = require('../../controllers/notificationsController');
      const owner = await User.findById(request.createdBy).select('email username');
      if (owner) await createNotification({ userId: owner._id, actorId: req.user && req.user.id, type: 'request_approved', title: 'Request approved', body: `Your request ${request.title?.en || request._id} was approved`, link: `/requests/${request._id}`, data: { requestId: request._id } });
    } catch (e) {}

    res.json({ message: 'approved', request });
  } catch (err) {
    next(err);
  }
};

// POST /admin/requests/:id/reject
exports.rejectRequest = async (req, res, next) => {
  try {
    const reason = req.body.reason || 'No reason provided';
    const request = await Request.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true }).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

    try {
      const owner = await User.findById(request.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your request was rejected', `<p>Hi ${owner.username || ''}, your request "${request.title?.en || request._id}" was rejected. Reason: ${reason}</p>`).catch(() => {});
      }
    } catch (e) {}

    // in-app notification
    try {
      const { createNotification } = require('../../controllers/notificationsController');
      const owner = await User.findById(request.createdBy).select('email username');
      if (owner) await createNotification({ userId: owner._id, actorId: req.user && req.user.id, type: 'request_rejected', title: 'Request rejected', body: `Your request ${request.title?.en || request._id} was rejected: ${reason}`, link: `/requests/${request._id}`, data: { requestId: request._id } });
    } catch (e) {}

    res.json({ message: 'rejected', request });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/requests/:id
exports.deleteRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await Request.deleteOne({ _id: request._id });

    try {
      const owner = await User.findById(request.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your request was deleted', `<p>Hi ${owner.username || ''}, your request "${request.title?.en || request._id}" was deleted by an admin.</p>`).catch(() => {});
      }
    } catch (e) {}

    res.json({ message: 'deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
