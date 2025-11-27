const PromotionPurchase = require('../models/PromotionPurchase');

const ACTIVE_STATUSES = ['active', 'pending'];

/**
 * Builds a map of userId -> promotion snapshot (plan title, amount, remaining days, status).
 * Only the most recent active/pending purchase per user is returned.
 */
async function buildPromotionSnapshots(userIds = []) {
  const uniqueIds = Array.from(new Set((userIds || []).map(id => String(id)).filter(Boolean)));
  if (!uniqueIds.length) return {};

  const purchases = await PromotionPurchase.find({
    user: { $in: uniqueIds },
    status: { $in: ACTIVE_STATUSES },
  })
    .sort({ createdAt: -1 })
    .populate('plan')
    .lean();

  const map = {};
  const now = Date.now();
  for (const purchase of purchases) {
    const key = String(purchase.user);
    if (map[key]) continue;
    const endDate = purchase.endDate ? new Date(purchase.endDate) : null;
    const remainingDays = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now) / (24 * 3600 * 1000))) : null;
    const planTitle = purchase.plan?.title || 'Custom Plan';
    map[key] = {
      planName: planTitle,
      amount: purchase.amount || purchase.plan?.price || 0,
      remainingDays,
      status: purchase.status,
      endsAt: endDate,
    };
  }
  return map;
}

module.exports = { buildPromotionSnapshots };

