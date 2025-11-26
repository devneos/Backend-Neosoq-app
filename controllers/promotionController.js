const mongoose = require('mongoose');
const crypto = require('crypto');
const PromotionPlan = require('../models/PromotionPlan');
const PromotionPurchase = require('../models/PromotionPurchase');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const Transaction = require('../models/Transaction');
const IdempotencyKey = require('../models/IdempotencyKey');

// GET /promotions
const listPlans = async (req, res) => {
  const plans = await PromotionPlan.find({ active: true }).sort({ price: 1 }).lean();
  res.json({ plans });
};

// GET /promotions/:id
const getPlan = async (req, res) => {
  const plan = await PromotionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Promotion plan not found' });
  res.json({ plan });
};

// POST /promotions/purchase
const purchasePlan = async (req, res) => {
  const { planId, paymentMethod = 'myfatoorah', txnId = null, idempotencyKey } = req.body;
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const plan = await PromotionPlan.findById(planId);
  if (!plan || !plan.active) return res.status(400).json({ message: 'Invalid plan' });

  const amount = Number(plan.price || 0);
  const adminFee = Math.round(((plan.adminFeePercent || 0) * amount) / 100 * 100) / 100; // 2-decimal

  // Basic idempotency: if an IdempotencyKey with a stored response exists, return it
  if (idempotencyKey) {
    try {
      const existing = await IdempotencyKey.findOne({ key: idempotencyKey }).lean();
      if (existing && existing.response && existing.response.statusCode) {
        return res.status(existing.response.statusCode).json(existing.response.body || {});
      }
    } catch (e) {
      console.warn('idempotency read error', e);
    }
  }

  // Create a purchase record in pending state and attach idempotencyKey in meta
  const reference = `promo_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const purchase = await PromotionPurchase.create({
    plan: plan._id,
    user: userId,
    amount,
    adminFee,
    paymentMethod,
    txnId: txnId || null,
    status: 'pending',
    meta: { reference, idempotencyKey }
  });

  // Wallet flow: charge user wallet immediately and activate promotion
  if (paymentMethod === 'wallet') {
    const session = await mongoose.startSession();
    try {
      let wallet;
      try {
        await session.withTransaction(async () => {
          wallet = await Wallet.findOne({ userId }).session(session);
          if (!wallet || (wallet.available || 0) < amount) throw new Error('Insufficient funds');
          wallet.available = (wallet.available || 0) - amount;
          await wallet.save({ session });

          // platform/admin wallet (userId=null) credit
          let adminWallet = await Wallet.findOne({ userId: null }).session(session);
          if (!adminWallet) {
            adminWallet = await Wallet.create([{ userId: null, available: 0, locked: 0, currency: 'KWD' }], { session });
            adminWallet = adminWallet[0];
          }
          adminWallet.available = (adminWallet.available || 0) + amount;
          await adminWallet.save({ session });

          const balanceAfter = wallet.available;
          await Ledger.create([{ walletId: wallet._id, amount: amount, type: 'debit', category: 'internal', referenceId: reference, idempotencyKey, balanceAfter, meta: { for: 'promotion_purchase', purchaseId: purchase._id } }, { walletId: adminWallet._id, amount: amount, type: 'credit', category: 'internal', referenceId: reference, idempotencyKey, balanceAfter: adminWallet.available, meta: { fromUser: userId, purchaseId: purchase._id } }], { session });

          // mark purchase active
          purchase.status = 'active';
          purchase.startDate = new Date();
          if (plan.durationDays) purchase.endDate = new Date(Date.now() + (Number(plan.durationDays) || 0) * 24 * 3600 * 1000);
          await purchase.save({ session });
        });
      } catch (tranErr) {
        // fallback non-transactional
        console.warn('wallet purchase transaction failed, falling back:', tranErr.message || tranErr);
        wallet = await Wallet.findOne({ userId });
        if (!wallet || (wallet.available || 0) < amount) throw new Error('Insufficient funds');
        wallet.available = (wallet.available || 0) - amount;
        await wallet.save();

        let adminWallet = await Wallet.findOne({ userId: null });
        if (!adminWallet) adminWallet = await Wallet.create({ userId: null, available: amount, locked: 0, currency: 'KWD' });
        else { adminWallet.available = (adminWallet.available || 0) + amount; await adminWallet.save(); }

        await Ledger.create({ walletId: wallet._id, amount: amount, type: 'debit', category: 'internal', referenceId: reference, idempotencyKey, balanceAfter: wallet.available, meta: { for: 'promotion_purchase', purchaseId: purchase._id } });

        await Ledger.create({ walletId: adminWallet._id, amount: amount, type: 'credit', category: 'internal', referenceId: reference, idempotencyKey, balanceAfter: adminWallet.available, meta: { fromUser: userId, purchaseId: purchase._id } });

        purchase.status = 'active';
        purchase.startDate = new Date();
        if (plan.durationDays) purchase.endDate = new Date(Date.now() + (Number(plan.durationDays) || 0) * 24 * 3600 * 1000);
        await purchase.save();
      }
    } finally {
      session.endSession();
    }

    // store idempotency response if key present
    if (idempotencyKey) {
      try { await IdempotencyKey.findOneAndUpdate({ key: idempotencyKey }, { $set: { response: { statusCode: 201, body: { purchase } }, used: true } }, { upsert: true }); } catch (e) { console.warn('persist idempotency response failed', e); }
    }

    // notify user that promotion is active
    try {
      const { createNotification } = require('./notificationsController');
      await createNotification({ userId: userId, actorId: userId, type: 'promotion_active', title: 'Promotion active', body: `Your promotion ${plan.title || 'plan'} is active`, link: `/promotions/${purchase._id}`, data: { purchaseId: purchase._id } });
    } catch (e) {}

    return res.status(201).json({ purchase });
  }

  // MyFatoorah flow: create payment session and return checkout url
  if (paymentMethod === 'myfatoorah' || paymentMethod === 'card' || paymentMethod === 'myfatoorah_card') {
    try {
      if (!process.env.MYFATOORAH_API_KEY || !process.env.MYFATOORAH_BASE_URL) {
        return res.status(500).json({ message: 'Payment provider not configured' });
      }

      // require service lazily so tests can mock ../services/myfatoorahService after app is required
      const { createPayment } = require('../services/myfatoorahService');
      const resp = await createPayment({ amount, currency: 'KWD', reference, metadata: { purchaseId: purchase._id.toString(), userId, idempotencyKey }, redirect: req.body.redirectUrl });
      const checkoutUrl = resp && resp.redirect && resp.redirect.url ? resp.redirect.url : (resp && resp.raw && resp.raw.PaymentURL) || null;
      const sessionId = resp && resp.id ? resp.id : null;

      const body = { purchase, checkoutUrl, sessionId, raw: resp };
      if (idempotencyKey) {
        try { await IdempotencyKey.findOneAndUpdate({ key: idempotencyKey }, { $set: { response: { statusCode: 200, body }, used: true } }, { upsert: true }); } catch (e) { console.warn('persist idempotency response failed', e); }
      }

      return res.json(body);
    } catch (e) {
      console.error('createPayment error', e && e.response ? e.response.data : e);
      return res.status(500).json({ message: 'Failed to create payment session' });
    }
  }

  // fallback: return created purchase record
  return res.status(201).json({ purchase });
};

// POST /promotions/webhooks/myfatoorah
const myfatoorahWebhook = async (req, res) => {
  try {
    // parse payload similar to wallet controller
    let payload = req.body;
    const tx = payload.data?.object || payload.data || payload;
    const status = tx?.status || tx?.transaction?.status || (tx?.paid ? 'paid' : undefined);
    const reference = tx?.CustomerReference || tx?.reference || tx?.InvoiceId || tx?.invoiceId || tx?.id || tx?.transaction?.id;

    // Try to locate by reference in purchase.meta.reference or by purchaseId in metadata
    let purchase = null;
    if (tx?.metadata && tx.metadata.purchaseId) {
      purchase = await PromotionPurchase.findById(tx.metadata.purchaseId);
    }
    if (!purchase && reference) {
      purchase = await PromotionPurchase.findOne({ 'meta.reference': reference });
    }

    if (!purchase) {
      console.error('promotion webhook: purchase not found', { reference, payload: tx });
      return res.status(404).json({ error: 'purchase not found' });
    }

    const success = ['paid', 'captured', 'success'].includes((status || '').toString().toLowerCase());
    if (!success) return res.status(200).json({ ok: true, message: 'ignored non-paid status' });

    // idempotency: check if transaction already recorded on this purchase
    if (purchase.txnId && purchase.txnId === (tx.id || tx.transaction?.id || reference)) {
      return res.status(200).json({ ok: true, idempotent: true });
    }

    // mark purchase completed/active and save txn info
    purchase.txnId = tx.id || tx.transaction?.id || reference;
    purchase.status = 'completed';
    purchase.amount = Number(tx.amount || purchase.amount || 0);
    purchase.adminFee = purchase.adminFee || Math.round(((purchase.adminFee || 0) * (purchase.amount || 0)) / 100 * 100) / 100;
    purchase.startDate = purchase.startDate || new Date();
    // compute endDate using plan duration
    const plan = await PromotionPlan.findById(purchase.plan);
    if (plan && plan.durationDays) purchase.endDate = new Date((purchase.startDate || new Date()).getTime() + Number(plan.durationDays) * 24 * 3600 * 1000);

    await purchase.save();

    // notify user that promotion completed/active via webhook
    try {
      const { createNotification } = require('../controllers/notificationsController');
      await createNotification({ userId: purchase.user, actorId: purchase.user, type: 'promotion_completed', title: 'Promotion completed', body: `Your promotion has been completed`, link: `/promotions/${purchase._id}`, data: { purchaseId: purchase._id } });
    } catch (e) {}

    // create Transaction record for reporting
    try {
      await Transaction.create({ userId: purchase.user, type: 'promotion', relatedId: purchase._id, description: `Promotion purchase ${purchase._id}`, amount: purchase.amount || 0, paymentMethod: 'myfatoorah', status: 'completed', txnId: purchase.txnId, adminFee: purchase.adminFee || 0, totalCharged: purchase.amount || 0, metadata: { raw: tx } });
    } catch (e) { console.warn('failed to create transaction record', e); }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('promotion myfatoorah webhook', e);
    return res.status(500).json({ error: 'webhook processing failed' });
  }
};

module.exports = {
  listPlans,
  getPlan,
  purchasePlan,
  myfatoorahWebhook
};
