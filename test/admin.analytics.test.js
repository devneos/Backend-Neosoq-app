const request = require('supertest');
const app = require('../server');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');

describe('Admin analytics', () => {
  let adminToken;

  beforeEach(async () => {
    await Transaction.deleteMany({});
    await User.deleteMany({});
    await ChatMessage.deleteMany({});

    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const user = await User.create({ username: 'seller1', email: 's1@example.com', rating: 4.8, position: 'Seller' });
    await Transaction.create({ userId: user._id, type: 'listing_purchase', amount: 100, status: 'completed' });

    // create chat conversation and messages for avg calculation
    const Conversation = require('../models/Conversation');
    const conv = await Conversation.create({ participants: [user._id] });
    const now = new Date();
    await ChatMessage.create({ conversationId: conv._id, sender: user._id, body: 'hi', createdAt: now });
  });

  afterEach(async () => {
    try { await Transaction.deleteMany({}); } catch (e) {}
    try { await User.deleteMany({}); } catch (e) {}
    try { await ChatMessage.deleteMany({}); } catch (e) {}
  });

  test('GET /admin/analytics/revenue-trend', async () => {
    const res = await request(app).get('/admin/analytics/revenue-trend').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /admin/analytics/monthly-transactions', async () => {
    const res = await request(app).get('/admin/analytics/monthly-transactions').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /admin/analytics/top-performers', async () => {
    const res = await request(app).get('/admin/analytics/top-performers').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /admin/analytics/dashboard-cards', async () => {
    const res = await request(app).get('/admin/analytics/dashboard-cards').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('monthlyRevenue');
    expect(res.body).toHaveProperty('lifetimeTransactions');
  });
});
