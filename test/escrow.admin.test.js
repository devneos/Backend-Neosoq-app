const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const Escrow = require('../models/Escrow');
const jwt = require('jsonwebtoken');

describe('Escrow admin force operations', () => {
  let adminToken, buyerToken, workerToken, adminUser, buyer, worker;
  beforeEach(async () => {
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});
    await User.deleteMany({});
    await Escrow.deleteMany({});

    adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    buyer = await User.create({ username: 'buyer', email: 'buyer@example.com' });
    worker = await User.create({ username: 'worker', email: 'worker@example.com' });

    adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
    buyerToken = jwt.sign({ UserInfo: { userId: buyer._id, username: buyer.username, roles: [] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
    workerToken = jwt.sign({ UserInfo: { userId: worker._id, username: worker.username, roles: [] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    // seed buyer wallet with funds
    await Wallet.create({ userId: buyer._id, available: 500, locked: 0, currency: 'KWD' });
  });

  test('admin can force-release escrow to worker', async () => {
    // create escrow as buyer
    const createRes = await request(app).post('/escrow').set('Authorization', `Bearer ${buyerToken}`).send({ workerId: worker._id.toString(), amount: 100 });
    expect(createRes.statusCode).toBe(201);
    const escrow = createRes.body.escrow;

    // admin force-release
    const res = await request(app).post(`/escrow/${escrow._id}/force-release`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    // verify worker wallet credited
    const w = await Wallet.findOne({ userId: worker._id });
    expect(w.available).toBe(100);
    const buyerWallet = await Wallet.findOne({ userId: buyer._id });
    expect(buyerWallet.locked).toBe(0);

    const ledgers = await Ledger.find({ referenceId: escrow._id.toString() }).lean();
    // there should be debit and credit ledger entries
    expect(ledgers.length).toBeGreaterThanOrEqual(2);
  });

  test('admin can force-refund escrow to buyer', async () => {
    const createRes = await request(app).post('/escrow').set('Authorization', `Bearer ${buyerToken}`).send({ workerId: worker._id.toString(), amount: 120 });
    expect(createRes.statusCode).toBe(201);
    const escrow = createRes.body.escrow;

    const res = await request(app).post(`/escrow/${escrow._id}/force-refund`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const buyerWallet = await Wallet.findOne({ userId: buyer._id });
    expect(buyerWallet.available).toBe(500); // back to original (500 -120 +120)

    const ledgers = await Ledger.find({ referenceId: escrow._id.toString() }).lean();
    expect(ledgers.length).toBeGreaterThanOrEqual(1);
  });
});
