const request = require('supertest');
const app = require('../server');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');

describe('Admin escrows', () => {
  let adminToken;
  let buyerId;
  let workerId;
  let escrowId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Escrow.deleteMany({});
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});

    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const buyer = await User.create({ username: 'buyer', email: 'buyer@example.com' });
    const worker = await User.create({ username: 'worker', email: 'worker@example.com' });
    buyerId = buyer._id;
    workerId = worker._id;

    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    // create wallets and a locked balance for the buyer
    await Wallet.create({ userId: buyerId, available: 0, locked: 200 });
    await Wallet.create({ userId: workerId, available: 0, locked: 0 });

    const esc = await Escrow.create({ type: 'listing', itemName: 'Test Item', buyerId, workerId, amount: 100, status: 'active', paymentMethod: 'card' });
    escrowId = esc._id;
  });

  afterEach(async () => {
    try { await Escrow.deleteMany({}); } catch (e) {}
    try { await User.deleteMany({}); } catch (e) {}
    try { await Wallet.deleteMany({}); } catch (e) {}
    try { await Ledger.deleteMany({}); } catch (e) {}
  });

  test('GET /admin/escrows - list', async () => {
    const res = await request(app)
      .get('/admin/escrows')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('itemName');
  });

  test('GET /admin/escrows - filter by status', async () => {
    const res = await request(app)
      .get('/admin/escrows?status=active')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  test('GET /admin/escrows/:id - details', async () => {
    const res = await request(app)
      .get(`/admin/escrows/${escrowId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('escrow');
    expect(res.body.escrow).toHaveProperty('amount');
    expect(Array.isArray(res.body.escrow.releaseHistory)).toBe(true);
  });

  test('POST /admin/escrows/:id/force-release', async () => {
    const res = await request(app)
      .post(`/admin/escrows/${escrowId}/force-release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('ok', true);
    const updated = await Escrow.findById(escrowId);
    expect(['completed','completed']).toContain(updated.status);
  });

  test('POST /admin/escrows/:id/force-refund', async () => {
    // create a fresh escrow to refund
    const esc = await Escrow.create({ type: 'request', itemName: 'Refund Item', buyerId, workerId, amount: 50, status: 'active', paymentMethod: 'wallet' });
    // ensure buyer has locked funds
    await Wallet.findOneAndUpdate({ userId: buyerId }, { $set: { locked: 50 } });

    const res = await request(app)
      .post(`/admin/escrows/${esc._id}/force-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('ok', true);
    const updated = await Escrow.findById(esc._id);
    expect(['cancelled','cancelled']).toContain(updated.status);
  });
});
