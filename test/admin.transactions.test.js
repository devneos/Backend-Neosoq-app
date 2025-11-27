const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Escrow = require('../models/Escrow');

describe('Admin transactions', () => {
  let adminToken;
  let userId;
  let listingId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
    await Listing.deleteMany({});
    await Escrow.deleteMany({});

    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const user = await User.create({ username: 'txuser', email: 'txuser@example.com' });
    userId = user._id;
    const listing = await Listing.create({ category: 'Electronics', title: { en: 'Camera' }, description: { en: 'Pro cam' }, price: 300, createdBy: user._id });
    listingId = listing._id;

    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    await Transaction.create([
      { userId, type: 'listing_purchase', relatedId: listingId, amount: 100, status: 'completed', paymentMethod: 'card' },
      { userId, type: 'debit', amount: 20, status: 'failed', paymentMethod: 'card' },
      { userId, type: 'credit', amount: 50, status: 'pending', paymentMethod: 'wallet' },
    ]);

    await Escrow.create({ buyerId: userId, workerId: userId, amount: 75, status: 'held', paymentMethod: 'card' });
  });

  afterEach(async () => {
    try { await Transaction.deleteMany({}); } catch (e) { /* ignore */ }
    try { await User.deleteMany({ email: 'txuser@example.com' }); } catch (e) { /* ignore */ }
    try { await Listing.deleteMany({}); } catch (e) { /* ignore */ }
    try { await Escrow.deleteMany({}); } catch (e) { /* ignore */ }
  });

  test('GET /admin/transactions - list', async () => {
    const res = await request(app)
      .get('/admin/transactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('itemName');
  });

  test('GET /admin/transactions/summary - cards', async () => {
    const res = await request(app)
      .get('/admin/transactions/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('totalTransactions');
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body.totalRevenue).toHaveProperty('value');
  });

  test('GET /admin/transactions/:id - details', async () => {
    const tx = await Transaction.findOne({});
    const res = await request(app)
      .get(`/admin/transactions/${tx._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('user');
  });
});
