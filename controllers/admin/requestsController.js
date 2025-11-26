const Request = require('../../models/Request');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const { buildFilter } = require('../../utils/filtering');

// GET /admin/requests
exports.listRequests = async (req, res, next) => {
  try {
    const allowed = ['status', 'pricingType', 'isPromoted'];
    const filter = buildFilter(req.query, allowed);

    if (req.query.search) {
      const q = req.query.search;
      filter.$or = [
        { 'title.en': { $regex: q, $options: 'i' } },
        { 'description.en': { $regex: q, $options: 'i' } },
      ];
    }

    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    const pipeline = [
      { $match: filter },
      { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'creator' } },
      { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'offers', localField: '_id', foreignField: 'requestId', as: 'applications' } },
      { $addFields: { totalApplications: { $size: '$applications' }, creatorName: '$creator.username', creatorAddress: '$creator.location.addressLine' } },
      { $project: { applications: 0, description: 0 } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const docs = await Request.aggregate(pipeline).exec();
    const totalAgg = await Request.aggregate([{ $match: filter }, { $count: 'total' }]);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    const page = Math.floor(skip / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));

    res.json({ docs, total, page, pages, limit });
  } catch (err) {
    next(err);
  }
};

// GET /admin/requests/:id
exports.getRequestDetails = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id).lean();
    if (!request) return res.status(404).json({ message: 'Request not found' });

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
      applicationDate: a.createdAt,
      status: a.status,
      coverLetter: a.proposalText,
    }));

    res.json({ request, applicants: appsFormatted });
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
