const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Dispute = require('../models/Dispute');

describe('Admin payments', () => {
  let adminToken;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
    await Wallet.deleteMany({});
    await WithdrawalRequest.deleteMany({});
    await Dispute.deleteMany({});

    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const user = await User.create({ username: 'puser', email: 'puser@example.com', phoneNumber: '12345' });
    userId = user._id;
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    await Wallet.create({ userId, available: 200, locked: 50 });
    await Transaction.create({ userId, type: 'listing_purchase', amount: 100, status: 'completed', paymentMethod: 'card' });
    await WithdrawalRequest.create({ userId, amount: 80, method: 'bank_transfer', status: 'pending' });
    await Dispute.create({ createdBy: userId, accusedUser: admin._id, issueType: 'fraud', description: { en: 'issue' }, status: 'open' });
  });

  afterEach(async () => {
    try { await User.deleteMany({}); } catch (e) {}
    try { await Transaction.deleteMany({}); } catch (e) {}
    try { await Wallet.deleteMany({}); } catch (e) {}
    try { await WithdrawalRequest.deleteMany({}); } catch (e) {}
    try { await Dispute.deleteMany({}); } catch (e) {}
  });

  test('GET /admin/payments/wallet-transactions', async () => {
    const res = await request(app).get('/admin/payments/wallet-transactions').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /admin/payments/withdrawal-requests', async () => {
    const res = await request(app).get('/admin/payments/withdrawal-requests').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /admin/payments/summary', async () => {
    const res = await request(app).get('/admin/payments/summary').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body).toHaveProperty('combinedWalletAvailable');
    expect(res.body).toHaveProperty('pendingWithdrawalCount');
  });
});
