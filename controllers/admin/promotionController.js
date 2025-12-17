const PromotionPlan = require('../../models/PromotionPlan');
const PromotionPurchase = require('../../models/PromotionPurchase');

// Helpers
const percentChange = (current = 0, prev = 0) => {
  if (!prev) return current > 0 ? 100 : 0;
  return Number((((current - prev) / Math.abs(prev)) * 100).toFixed(2));
};

const parseRange = (req) => {
  const now = new Date();
  const range = (req.query.range || '30d').toLowerCase();

  // custom date range
  if (req.query.start || req.query.end) {
    const start = req.query.start ? new Date(req.query.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end) : now;
    const spanMs = Math.max(1, end.getTime() - start.getTime());
    const prevEnd = new Date(start.getTime());
    const prevStart = new Date(start.getTime() - spanMs);
    return { start, end, prevStart, prevEnd };
  }

  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const end = now;
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, prevStart, prevEnd };
};

// Admin: create a promotion plan
const createPlan = async (req, res) => {
  const { title, description, price, durationDays, adminFeePercent = 10, active = true } = req.body;
  if (!title || price == null) return res.status(400).json({ message: 'title and price are required' });

  const plan = await PromotionPlan.create({ title, description, price, durationDays, adminFeePercent, active });
  res.status(201).json({ plan });
};

// Admin: update plan
const updatePlan = async (req, res) => {
  const plan = await PromotionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });
  Object.assign(plan, req.body);
  await plan.save();
  res.json({ plan });
};

// Admin: delete plan (only if no purchases exist)
const deletePlan = async (req, res) => {
  const planId = req.params.id;
  const plan = await PromotionPlan.findById(planId);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  const purchaseCount = await PromotionPurchase.countDocuments({ plan: planId });
  if (purchaseCount > 0) {
    return res.status(400).json({ message: 'Cannot delete plan with existing purchases' });
  }

  await PromotionPlan.deleteOne({ _id: planId });
  res.json({ ok: true });
};

// Admin: list plans
const listPlans = async (req, res) => {
  const plans = await PromotionPlan.find().sort({ createdAt: -1 }).lean();
  res.json({ plans });
};

// Admin: list purchases
const listPurchases = async (req, res) => {
  const purchases = await PromotionPurchase.find().populate('plan').populate('user').sort({ createdAt: -1 }).limit(200);
  res.json({ purchases });
};

// Admin: get single purchase
const getPurchase = async (req, res) => {
  const purchase = await PromotionPurchase.findById(req.params.id).populate('plan').populate('user');
  if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
  res.json({ purchase });
};

// Admin: summary cards (revenue, purchases, AOV, conversion)
const getSummary = async (req, res) => {
  const { start, end, prevStart, prevEnd } = parseRange(req);

  const aggregateMetrics = async (startDate, endDate) => {
    const match = { createdAt: { $gte: startDate, $lte: endDate } };
    const [result] = await PromotionPurchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$amount' },
          purchases: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]);

    const revenue = result?.revenue || 0;
    const purchases = result?.purchases || 0;
    const completed = result?.completed || 0;
    const aov = purchases ? revenue / purchases : 0;
    const conversionRate = purchases ? (completed / purchases) * 100 : 0; // completed vs total attempts in period
    return { revenue, purchases, aov, conversionRate };
  };

  const [current, previous] = await Promise.all([
    aggregateMetrics(start, end),
    aggregateMetrics(prevStart, prevEnd),
  ]);

  const response = {
    range: {
      start,
      end,
      prevStart,
      prevEnd,
    },
    cards: {
      revenue: {
        value: current.revenue,
        changePct: percentChange(current.revenue, previous.revenue),
      },
      purchases: {
        value: current.purchases,
        changePct: percentChange(current.purchases, previous.purchases),
      },
      averageOrderValue: {
        value: Number(current.aov.toFixed(2)),
        changePct: percentChange(current.aov, previous.aov),
      },
      conversionRate: {
        value: Number(current.conversionRate.toFixed(2)),
        changePct: percentChange(current.conversionRate, previous.conversionRate),
      },
    },
  };

  res.json(response);
};

module.exports = {
  createPlan,
  updatePlan,
  deletePlan,
  listPlans,
  listPurchases,
  getPurchase,
  getSummary,
};
