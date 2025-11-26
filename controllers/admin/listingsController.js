const Listing = require('../../models/Listing');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const { buildFilter } = require('../../utils/filtering');

// GET /admin/listings
exports.listListings = async (req, res, next) => {
  try {
    const allowed = ['status', 'category', 'sellerType'];
    const filter = buildFilter(req.query, allowed);

    // search by title (localized en.title) or description
    if (req.query.search) {
      const q = req.query.search;
      filter.$or = [
        { 'title.en': { $regex: q, $options: 'i' } },
        { 'description.en': { $regex: q, $options: 'i' } },
      ];
    }

    // method filter (email/phone/google)
    if (req.query.method) {
      if (req.query.method === 'phone') filter['sellerPhoneExists'] = true;
      if (req.query.method === 'email') filter['sellerEmailExists'] = true;
      if (req.query.method === 'google') filter['sellerGoogle'] = true;
    }

    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);

    // Build aggregation to join seller info and count offers
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'seller',
        },
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      // compute offers count
      {
        $lookup: {
          from: 'offers',
          localField: '_id',
          foreignField: 'listingId',
          as: 'offers',
        },
      },
      {
        $addFields: {
          offersCount: { $size: '$offers' },
          sellerName: '$seller.username',
          sellerPhone: '$seller.phoneNumber',
          sellerEmail: '$seller.email',
        },
      },
      { $project: { offers: 0, description: 0 } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const docs = await Listing.aggregate(pipeline).exec();

    const totalAgg = await Listing.aggregate([{ $match: filter }, { $count: 'total' }]);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;

    const page = Math.floor(skip / limit) + 1;
    const pages = Math.max(1, Math.ceil(total / limit));

    res.json({ docs, total, page, pages, limit });
  } catch (err) {
    next(err);
  }
};

// GET /admin/listings/:id
exports.getListingDetails = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const offers = await Offer.find({ listingId: listing._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // populate bidder info
    const userIds = offers.map(o => o.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('username profileImage phoneNumber').lean();
    const usersMap = {};
    users.forEach(u => { usersMap[String(u._id)] = u; });

    const offersFormatted = offers.map(o => ({
      id: o._id,
      bidderName: usersMap[String(o.userId)]?.username || null,
      bidderProfileImage: usersMap[String(o.userId)]?.profileImage || null,
      phoneNumber: usersMap[String(o.userId)]?.phoneNumber || null,
      amount: o.price,
      date: o.createdAt,
      status: o.status,
      proposalText: o.proposalText,
    }));

    res.json({ listing, offers: offersFormatted });
  } catch (err) {
    next(err);
  }
};

// POST /admin/listings/:id/approve
exports.approveListing = async (req, res, next) => {
  try {
    const listing = await Listing.findByIdAndUpdate(req.params.id, { reviewCompleted: true, reviewNote: req.body.note || '' }, { new: true }).lean();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    // notify owner (email + in-app notification)
    try {
      const owner = await User.findById(listing.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your listing was approved', `<p>Hi ${owner.username || ''}, your listing "${listing.title?.en || listing._id}" has been approved.</p>`).catch(() => {});
      }
      // in-app notification
      try {
        const { createNotification } = require('../../controllers/notificationsController');
        if (owner) await createNotification({ userId: owner._id, actorId: req.user && req.user.id, type: 'listing_approved', title: 'Listing approved', body: `Your listing ${listing.title?.en || listing._id} was approved`, link: `/listings/${listing._id}`, data: { listingId: listing._id } });
      } catch (e) { }
    } catch (e) { }

    res.json({ message: 'approved', listing });
  } catch (err) {
    next(err);
  }
};

// POST /admin/listings/:id/reject
exports.rejectListing = async (req, res, next) => {
  try {
    const reason = req.body.reason || 'No reason provided';
    const listing = await Listing.findByIdAndUpdate(req.params.id, { status: 'closed', reviewCompleted: true, reviewNote: reason }, { new: true }).lean();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    // notify owner with reason (email + in-app)
    try {
      const owner = await User.findById(listing.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your listing was rejected', `<p>Hi ${owner.username || ''}, your listing "${listing.title?.en || listing._id}" was rejected for the following reason:</p><p>${reason}</p>`).catch(() => {});
      }
      try {
        const { createNotification } = require('../../controllers/notificationsController');
        if (owner) await createNotification({ userId: owner._id, actorId: req.user && req.user.id, type: 'listing_rejected', title: 'Listing rejected', body: `Your listing ${listing.title?.en || listing._id} was rejected: ${reason}`, link: `/listings/${listing._id}`, data: { listingId: listing._id } });
      } catch (e) { }
    } catch (e) { }

    res.json({ message: 'rejected', listing });
  } catch (err) {
    next(err);
  }
};

// DELETE /admin/listings/:id
exports.deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    await Listing.deleteOne({ _id: listing._id });

    // notify owner (email + in-app)
    try {
      const owner = await User.findById(listing.createdBy).select('email username');
      if (owner && owner.email) {
        const { sendTemplateEmail } = require('../../helpers/auth');
        sendTemplateEmail(owner.email, 'Your listing was deleted', `<p>Hi ${owner.username || ''}, your listing "${listing.title?.en || listing._id}" was deleted by an admin.</p>`).catch(() => {});
      }
      try {
        const { createNotification } = require('../../controllers/notificationsController');
        if (owner) await createNotification({ userId: owner._id, actorId: req.user && req.user.id, type: 'listing_deleted', title: 'Listing deleted', body: `Your listing ${listing.title?.en || listing._id} was deleted by admin`, data: { listingId: listing._id } });
      } catch (e) { }
    } catch (e) { }

    res.json({ message: 'deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
