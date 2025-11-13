const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const Escrow = require('../models/Escrow');
const timeAgo = require('../helpers/timeAgo');
const IdempotencyKey = require('../models/IdempotencyKey');

// POST /escrow -> create escrow and lock funds
const createEscrow = async (req, res) => {
  const sessionUser = req.user?.id;
  if (!sessionUser) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { workerId, listingId, requestId, offerId, amount, idempotencyKey } = req.body;
    if (!workerId || !amount || Number(amount) <= 0) return res.status(400).json({ error: 'workerId and amount required' });

    const session = await mongoose.startSession();
    let escrow;
    try {
      try {
        await session.withTransaction(async () => {
          const buyerWallet = await Wallet.findOne({ userId: sessionUser }).session(session);
          if (!buyerWallet || (buyerWallet.available || 0) < Number(amount)) throw new Error('Insufficient funds');

          // debit available and increase locked
          buyerWallet.available = (buyerWallet.available || 0) - Number(amount);
          buyerWallet.locked = (buyerWallet.locked || 0) + Number(amount);
          buyerWallet.updatedAt = new Date();
          await buyerWallet.save({ session });

          const buyerBalanceAfter = buyerWallet.available;
          const lockedAfter = buyerWallet.locked;

          // ledger entry for hold
          const ledger = await Ledger.create([{ walletId: buyerWallet._id, amount: Number(amount), type: 'debit', category: 'escrow_hold', referenceId: idempotencyKey || null, idempotencyKey, balanceAfter: buyerBalanceAfter, meta: { lockedAfter } }], { session });

          escrow = await Escrow.create([{ buyerId: sessionUser, workerId, listingId: listingId || null, requestId: requestId || null, offerId: offerId || null, amount: Number(amount), status: 'active', confirmations: { buyer: false, worker: false }, lockedLedgerId: ledger[0]._id }], { session });
          escrow = escrow[0];
        });
      } catch (tranErr) {
        // fallback to non-transactional path (useful for in-memory mongo in tests)
        console.warn('createEscrow transaction failed, falling back:', tranErr.message || tranErr);
        const buyerWallet = await Wallet.findOne({ userId: sessionUser });
        if (!buyerWallet || (buyerWallet.available || 0) < Number(amount)) throw new Error('Insufficient funds');
        buyerWallet.available = (buyerWallet.available || 0) - Number(amount);
        buyerWallet.locked = (buyerWallet.locked || 0) + Number(amount);
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();

        const buyerBalanceAfter = buyerWallet.available;
        const ledger = await Ledger.create({ walletId: buyerWallet._id, amount: Number(amount), type: 'debit', category: 'escrow_hold', referenceId: idempotencyKey || null, idempotencyKey, balanceAfter: buyerBalanceAfter, meta: { lockedAfter: buyerWallet.locked } });

        escrow = await Escrow.create({ buyerId: sessionUser, workerId, listingId: listingId || null, requestId: requestId || null, offerId: offerId || null, amount: Number(amount), status: 'active', confirmations: { buyer: false, worker: false }, lockedLedgerId: ledger._id });
      }
    } finally {
      session.endSession();
    }

    return res.status(201).json({ escrow });
  } catch (e) {
    console.error('createEscrow', e);
    return res.status(400).json({ error: e.message || 'Failed to create escrow' });
  }
};

// Admin: POST /escrow/:id/force-release -> force release funds to worker (admin only)
const adminForceRelease = async (req, res) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id);
    if (!escrow) return res.status(404).json({ error: 'Not found' });
    if (escrow.status !== 'active') return res.status(400).json({ error: 'Escrow not active' });

    // Reuse release logic but bypass confirmations and mark adminAction
    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId }).session(session);
          const workerWallet = await Wallet.findOne({ userId: escrow.workerId }).session(session) || await Wallet.create([{ userId: escrow.workerId, available: 0, locked: 0, currency: 'KWD' }], { session }).then(r => r[0]);
          if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');

          buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
          buyerWallet.updatedAt = new Date();
          await buyerWallet.save({ session });

          await Ledger.create([{ walletId: buyerWallet._id, amount: escrow.amount, type: 'debit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: buyerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } }], { session });

          workerWallet.available = (workerWallet.available || 0) + escrow.amount;
          workerWallet.updatedAt = new Date();
          await workerWallet.save({ session });
          await Ledger.create([{ walletId: workerWallet._id, amount: escrow.amount, type: 'credit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: workerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } }], { session });

          escrow.status = 'completed';
          escrow.adminAction = { by: req.user?.id, at: new Date(), action: 'force_release' };
          await escrow.save({ session });
        });
      } catch (tranErr) {
        console.warn('adminForceRelease transaction failed, falling back:', tranErr.message || tranErr);
        const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId });
        const workerWallet = await Wallet.findOne({ userId: escrow.workerId }) || await Wallet.create({ userId: escrow.workerId, available: 0, locked: 0, currency: 'KWD' });
        if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');
        buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
  await Ledger.create({ walletId: buyerWallet._id, amount: escrow.amount, type: 'debit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: buyerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } });

        workerWallet.available = (workerWallet.available || 0) + escrow.amount;
        workerWallet.updatedAt = new Date();
        await workerWallet.save();
  await Ledger.create({ walletId: workerWallet._id, amount: escrow.amount, type: 'credit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: workerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } });

        escrow.status = 'completed';
        escrow.adminAction = { by: req.user?.id, at: new Date(), action: 'force_release' };
        await escrow.save();
      }
    } finally {
      session.endSession();
    }

    // persist idempotency response if supplied
    if (req.idempotencyKey) {
      try {
        await IdempotencyKey.findOneAndUpdate({ key: req.idempotencyKey }, { $set: { response: { statusCode: 200, body: { ok: true, escrow } }, used: true } }, { upsert: true });
      } catch (e) { console.warn('failed to persist idempotency response for adminForceRelease', e); }
    }

    return res.json({ ok: true, escrow });
  } catch (e) {
    console.error('adminForceRelease', e);
    return res.status(400).json({ error: e.message || 'Failed to force release' });
  }
};

// Admin: POST /escrow/:id/force-refund -> force refund to buyer (admin only)
const adminForceRefund = async (req, res) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id);
    if (!escrow) return res.status(404).json({ error: 'Not found' });
    if (escrow.status !== 'active') return res.status(400).json({ error: 'Escrow not active' });

    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId }).session(session);
          if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');

          buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
          buyerWallet.available = (buyerWallet.available || 0) + escrow.amount;
          buyerWallet.updatedAt = new Date();
          await buyerWallet.save({ session });

          await Ledger.create([{ walletId: buyerWallet._id, amount: escrow.amount, type: 'credit', category: 'refund', referenceId: escrow._id.toString(), balanceAfter: buyerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } }], { session });

          escrow.status = 'cancelled';
          escrow.adminAction = { by: req.user?.id, at: new Date(), action: 'force_refund' };
          await escrow.save({ session });
        });
      } catch (tranErr) {
        console.warn('adminForceRefund transaction failed, falling back:', tranErr.message || tranErr);
        const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId });
        if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');
        buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
        buyerWallet.available = (buyerWallet.available || 0) + escrow.amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
  await Ledger.create({ walletId: buyerWallet._id, amount: escrow.amount, type: 'credit', category: 'refund', referenceId: escrow._id.toString(), balanceAfter: buyerWallet.available, meta: { escrow: escrow._id, admin: req.user?.id } });

        escrow.status = 'cancelled';
        escrow.adminAction = { by: req.user?.id, at: new Date(), action: 'force_refund' };
        await escrow.save();
      }
    } finally {
      session.endSession();
    }

    if (req.idempotencyKey) {
      try { await IdempotencyKey.findOneAndUpdate({ key: req.idempotencyKey }, { $set: { response: { statusCode: 200, body: { ok: true, escrow } }, used: true } }, { upsert: true }); } catch (e) { console.warn('failed to persist idempotency response for adminForceRefund', e); }
    }

    return res.json({ ok: true, escrow });
  } catch (e) {
    console.error('adminForceRefund', e);
    return res.status(400).json({ error: e.message || 'Failed to force refund' });
  }
};

// PUT /escrow/:id/confirm -> buyer or worker confirms
const confirmEscrow = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const id = req.params.id;
    const escrow = await Escrow.findById(id);
    if (!escrow) return res.status(404).json({ error: 'Not found' });

    if (String(escrow.buyerId) === String(uid)) escrow.confirmations.buyer = true;
    if (String(escrow.workerId) === String(uid)) escrow.confirmations.worker = true;

    await escrow.save();
    return res.json({ escrow });
  } catch (e) {
    console.error('confirmEscrow', e);
    return res.status(500).json({ error: 'Failed to confirm' });
  }
};

// POST /escrow/:id/release -> release funds when both confirmed
const releaseEscrow = async (req, res) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id);
    if (!escrow) return res.status(404).json({ error: 'Not found' });
    if (escrow.status !== 'active') return res.status(400).json({ error: 'Escrow not active' });
    if (!escrow.confirmations.buyer || !escrow.confirmations.worker) return res.status(400).json({ error: 'Both parties must confirm' });

    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          // debit buyer locked and credit worker available
          const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId }).session(session);
          const workerWallet = await Wallet.findOne({ userId: escrow.workerId }).session(session) || await Wallet.create([{ userId: escrow.workerId, available: 0, locked: 0, currency: 'KWD' }], { session }).then(r => r[0]);

          if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');

          buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
          buyerWallet.updatedAt = new Date();
          await buyerWallet.save({ session });

          const buyerBalanceAfter = buyerWallet.available;
          await Ledger.create([{ walletId: buyerWallet._id, amount: escrow.amount, type: 'debit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: buyerBalanceAfter, meta: { escrow: escrow._id } }], { session });

          workerWallet.available = (workerWallet.available || 0) + escrow.amount;
          workerWallet.updatedAt = new Date();
          await workerWallet.save({ session });
          const workerBalanceAfter = workerWallet.available;
          await Ledger.create([{ walletId: workerWallet._id, amount: escrow.amount, type: 'credit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: workerBalanceAfter, meta: { escrow: escrow._id } }], { session });

          escrow.status = 'completed';
          await escrow.save({ session });
        });
      } catch (tranErr) {
        console.warn('releaseEscrow transaction failed, falling back:', tranErr.message || tranErr);
        const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId });
        const workerWallet = await Wallet.findOne({ userId: escrow.workerId }) || await Wallet.create({ userId: escrow.workerId, available: 0, locked: 0, currency: 'KWD' });
        if (!buyerWallet || (buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');
        buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
        await Ledger.create({ walletId: buyerWallet._id, amount: escrow.amount, type: 'debit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: buyerWallet.available, meta: { escrow: escrow._id } });

        workerWallet.available = (workerWallet.available || 0) + escrow.amount;
        workerWallet.updatedAt = new Date();
        await workerWallet.save();
        await Ledger.create({ walletId: workerWallet._id, amount: escrow.amount, type: 'credit', category: 'escrow_release', referenceId: escrow._id.toString(), balanceAfter: workerWallet.available, meta: { escrow: escrow._id } });

        escrow.status = 'completed';
        await escrow.save();
      }
    } finally {
      session.endSession();
    }

    return res.json({ ok: true, escrow });
  } catch (e) {
    console.error('releaseEscrow', e);
    return res.status(400).json({ error: e.message || 'Failed to release' });
  }
};

// PUT /escrow/:id/cancel -> refund buyer
const cancelEscrow = async (req, res) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id);
    if (!escrow) return res.status(404).json({ error: 'Not found' });
    if (escrow.status !== 'active') return res.status(400).json({ error: 'Escrow not active' });

    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => {
          const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId }).session(session);
          if (!buyerWallet) throw new Error('Buyer wallet missing');
          if ((buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');

          buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
          buyerWallet.available = (buyerWallet.available || 0) + escrow.amount;
          buyerWallet.updatedAt = new Date();
          await buyerWallet.save({ session });

          const buyerBalanceAfter = buyerWallet.available;
          await Ledger.create([{ walletId: buyerWallet._id, amount: escrow.amount, type: 'credit', category: 'refund', referenceId: escrow._id.toString(), balanceAfter: buyerBalanceAfter, meta: { escrow: escrow._id } }], { session });

          escrow.status = 'cancelled';
          await escrow.save({ session });
        });
      } catch (tranErr) {
        console.warn('cancelEscrow transaction failed, falling back:', tranErr.message || tranErr);
        const buyerWallet = await Wallet.findOne({ userId: escrow.buyerId });
        if (!buyerWallet) throw new Error('Buyer wallet missing');
        if ((buyerWallet.locked || 0) < escrow.amount) throw new Error('Insufficient locked funds');

        buyerWallet.locked = (buyerWallet.locked || 0) - escrow.amount;
        buyerWallet.available = (buyerWallet.available || 0) + escrow.amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();

        const buyerBalanceAfter = buyerWallet.available;
        await Ledger.create({ walletId: buyerWallet._id, amount: escrow.amount, type: 'credit', category: 'refund', referenceId: escrow._id.toString(), balanceAfter: buyerBalanceAfter, meta: { escrow: escrow._id } });

        escrow.status = 'cancelled';
        await escrow.save();
      }
    } finally {
      session.endSession();
    }
    return res.json({ ok: true, escrow });
  } catch (e) {
    console.error('cancelEscrow', e);
    return res.status(400).json({ error: e.message || 'Failed to cancel' });
  }
};

// GET /escrow/:id -> details
const getEscrow = async (req, res) => {
  try {
    const id = req.params.id;
    const escrow = await Escrow.findById(id).lean();
    if (!escrow) return res.status(404).json({ error: 'Not found' });
    const ledgers = await Ledger.find({ referenceId: id }).sort({ createdAt: -1 }).lean();
    return res.json({ escrow: { ...escrow, timeAgo: timeAgo(escrow.createdAt) }, ledgers });
  } catch (e) {
    console.error('getEscrow', e);
    return res.status(500).json({ error: 'Failed to fetch escrow' });
  }
};

module.exports = { createEscrow, confirmEscrow, releaseEscrow, cancelEscrow, getEscrow, adminForceRelease, adminForceRefund };
