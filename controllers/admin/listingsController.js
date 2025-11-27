const Listing = require('../../models/Listing');
const Offer = require('../../models/Offer');
const User = require('../../models/User');
const { buildFilter } = require('../../utils/filtering');
const { parsePagination } = require('../../utils/pagination');
const { buildPromotionSnapshots } = require('../../utils/promotionHelpers');

const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const normalizeReviewStatus = (listing) => {
  if (!listing.reviewCompleted) return REVIEW_STATUS.PENDING;
  if (listing.status === 'closed' && listing.reviewNote) return REVIEW_STATUS.REJECTED;
  return REVIEW_STATUS.APPROVED;
};

const computeBudgetType = (price) => (typeof price === 'number' && price > 0 ? 'fixed' : 'open');

const promotionTierFromTitle = (title = '') => {
  if (/premium/i.test(title)) return 'Premium';
  if (/enhanced/i.test(title)) return 'Enhanced';
  if (/regular/i.test(title)) return 'Regular';
  if (/basic/i.test(title)) return 'Basic';
  return title || null;
};

const buildPromotionPayload = (snapshot, listing) => {
  if (snapshot) {
    return {
      tier: promotionTierFromTitle(snapshot.planName),
      planName: snapshot.planName,
      price: snapshot.amount,
      remainingDays: snapshot.remainingDays,
      status: snapshot.status,
      endsAt: snapshot.endsAt,
    };
  }
  if (listing.isPromoted) {
    return {
      tier: 'Manual',
      planName: 'Manual promotion',
      price: listing.price || 0,
      remainingDays: null,
      status: 'active',
      endsAt: null,
    };
  }
  return {
    tier: null,
    planName: null,
    price: 0,
    remainingDays: null,
    status: 'none',
    endsAt: null,
  };
};

// GET /admin/listings
exports.listListings = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const allowed = ['status', 'category', 'sellerType'];
    const filter = buildFilter(req.query, allowed);

    const search = (req.query.search || '').trim();
    if (search) {
      filter.$or = [
        { 'title.en': { $regex: search, $options: 'i' } },
        { 'description.en': { $regex: search, $options: 'i' } },
      ];
    }

    const occupationFilter = (req.query.occupation || req.query.occupationCategory || '').trim();
    const methodFilter = (req.query.method || '').toLowerCase();

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
          sellerPosition: '$seller.position',
          sellerProvider: '$seller.provider',
        },
      },
      { $project: { offers: 0, description: 0 } },
    ];

    if (occupationFilter) {
      pipeline.push({
        $match: { sellerPosition: { $regex: occupationFilter, $options: 'i' } },
      });
    }

    if (methodFilter === 'email') {
      pipeline.push({ $match: { sellerEmail: { $exists: true, $ne: null } } });
    } else if (methodFilter === 'phone') {
      pipeline.push({ $match: { sellerPhone: { $exists: true, $ne: null } } });
    } else if (methodFilter === 'google') {
      pipeline.push({ $match: { sellerProvider: 'google' } });
    }

    pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit });

    const [rows, totalAgg, statusAgg] = await Promise.all([
      Listing.aggregate(pipeline).exec(),
      Listing.aggregate([{ $match: filter }, { $count: 'total' }]),
      Listing.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const summaryCounts = statusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    const userIds = rows.map(row => row.createdBy).filter(Boolean);
    const promotionMap = await buildPromotionSnapshots(userIds);

    const docs = rows.map(listing => {
      const userId = listing.createdBy ? String(listing.createdBy) : null;
      const promotion = buildPromotionPayload(userId ? promotionMap[userId] : null, listing);
      const reviewStatus = normalizeReviewStatus(listing);
      const status =
        reviewStatus === REVIEW_STATUS.REJECTED ? 'rejected' : listing.status || 'open';
      const budgetType = computeBudgetType(listing.price);

      return {
        _id: listing._id,
        image: listing.images && listing.images.length ? listing.images[0] : null,
        title: listing.title,
        condition: listing.condition || null,
        category: listing.category || null,
        sellerName: listing.sellerName || null,
        sellerOccupation: listing.sellerPosition || null,
        price: listing.price ?? null,
        status,
        reviewStatus,
        promotion,
        totalBids: listing.offersCount || 0,
        budgetType,
        sellerContact: {
          phone: listing.sellerPhone || null,
          email: listing.sellerEmail || null,
          method: listing.sellerProvider || (listing.sellerEmail ? 'email' : 'phone'),
        },
        createdAt: listing.createdAt,
        isPromoted: listing.isPromoted || !!promotion.planName,
      };
    });

    res.json({
      docs,
      total,
      page,
      pages,
      limit,
      summary: {
        open: summaryCounts.open || 0,
        closed: summaryCounts.closed || 0,
        awarded: summaryCounts.awarded || 0,
        rejected: summaryCounts.closed ? summaryCounts.closed : 0,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/listings/:id
exports.getListingDetails = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).lean();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const owner = listing.createdBy
      ? await User.findById(listing.createdBy)
          .select('username email phoneNumber profileImage position roles provider rating ratingCount')
          .lean()
      : null;

    const promotionMap = await buildPromotionSnapshots(owner ? [owner._id] : []);
    const promotion = owner
      ? buildPromotionPayload(promotionMap[String(owner._id)], listing)
      : buildPromotionPayload(null, listing);

    const offers = await Offer.find({ listingId: listing._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

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
      completedTime: o.status === 'completed' ? o.updatedAt : null,
    }));

    res.json({
      listing: {
        ...listing,
        seller: owner
          ? {
              id: owner._id,
              name: owner.username,
              email: owner.email,
              phone: owner.phoneNumber,
              occupation: owner.position,
              method: owner.provider || (owner.email ? 'email' : 'phone'),
              rating: owner.rating,
              ratingCount: owner.ratingCount,
            }
          : null,
        budgetType: computeBudgetType(listing.price),
        reviewStatus: normalizeReviewStatus(listing),
        promotion,
      },
      offers: offersFormatted,
    });
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
