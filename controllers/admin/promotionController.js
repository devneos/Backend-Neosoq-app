const PromotionPlan = require('../../models/PromotionPlan');
const PromotionPurchase = require('../../models/PromotionPurchase');

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

module.exports = {
  createPlan,
  updatePlan,
  listPlans,
  listPurchases,
  getPurchase
};
