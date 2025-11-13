const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const Escrow = require('../models/Escrow');
const jwt = require('jsonwebtoken');

describe('Escrow flows', () => {
  let buyer, worker, buyerToken, workerToken;
  beforeEach(async () => {
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});
    await Escrow.deleteMany({});
    await User.deleteMany({});
    buyer = await User.create({ username: 'buyer', email: 'b@example.com' });
    worker = await User.create({ username: 'worker', email: 'w@example.com' });
    buyerToken = jwt.sign({ UserInfo: { userId: buyer._id, username: buyer.username, roles: [] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
    workerToken = jwt.sign({ UserInfo: { userId: worker._id, username: worker.username, roles: [] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
    // fund buyer wallet
    await Wallet.create({ userId: buyer._id, available: 500, locked: 0 });
  });

  test('create escrow locks funds and creates ledger', async () => {
    const res = await request(app).post('/escrow').set('Authorization', `Bearer ${buyerToken}`).send({ workerId: worker._id, amount: 100 });
    expect(res.statusCode).toBe(201);
    const body = res.body.escrow;
    expect(body.amount).toBe(100);
    // verify wallet
    const w = await Wallet.findOne({ userId: buyer._id });
    expect(w.available).toBe(400);
    expect(w.locked).toBe(100);
    // ledger entry
    const leds = await Ledger.find({ walletId: w._id });
    expect(leds.length).toBeGreaterThanOrEqual(1);
  });

  test('confirm by both and release funds to worker', async () => {
    const createRes = await request(app).post('/escrow').set('Authorization', `Bearer ${buyerToken}`).send({ workerId: worker._id, amount: 50 });
    const esc = createRes.body.escrow;
    await request(app).put(`/escrow/${esc._id}/confirm`).set('Authorization', `Bearer ${workerToken}`).send();
    await request(app).put(`/escrow/${esc._id}/confirm`).set('Authorization', `Bearer ${buyerToken}`).send();
    const rel = await request(app).post(`/escrow/${esc._id}/release`).set('Authorization', `Bearer ${buyerToken}`).send();
    expect(rel.statusCode).toBe(200);
    const wBuyer = await Wallet.findOne({ userId: buyer._id });
    const wWorker = await Wallet.findOne({ userId: worker._id });
    expect(wBuyer.locked).toBe(0);
    expect(wWorker.available).toBe(50);
    const ledgers = await Ledger.find({ referenceId: esc._id.toString() });
    expect(ledgers.length).toBeGreaterThanOrEqual(2);
  });

  test('cancel escrow refunds buyer', async () => {
    const createRes = await request(app).post('/escrow').set('Authorization', `Bearer ${buyerToken}`).send({ workerId: worker._id, amount: 60 });
    const esc = createRes.body.escrow;
    const cancelRes = await request(app).put(`/escrow/${esc._id}/cancel`).set('Authorization', `Bearer ${buyerToken}`).send();
    expect(cancelRes.statusCode).toBe(200);
    const w = await Wallet.findOne({ userId: buyer._id });
    expect(w.available).toBe(500);
    expect(w.locked).toBe(0);
    const ledger = await Ledger.findOne({ referenceId: esc._id.toString(), category: 'refund' });
    expect(ledger).toBeDefined();
  });
});
