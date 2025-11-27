const request = require('supertest');
// Mock sendTemplateEmail before importing app/controllers
jest.mock('../helpers/auth', () => {
  const original = jest.requireActual('../helpers/auth');
  return {
    ...original,
    sendTemplateEmail: jest.fn(async (email, message, header) => header || 'sent'),
  };
});

const app = require('../server');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Listing = require('../models/Listing');
const RequestModel = require('../models/Request');
const Wallet = require('../models/Wallet');
const { sendTemplateEmail } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

describe('Admin users endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
    await Listing.deleteMany({});
    await RequestModel.deleteMany({});
    await Wallet.deleteMany({});
  });

  test('GET /admin/users/summary returns counts and topPayers', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const userA = await User.create({ username: 'alice', email: 'alice@example.com' });
    const userB = await User.create({ username: 'bob', email: 'bob@example.com' });

    await Transaction.create({ userId: userA._id, amount: 100, status: 'completed', type: 'wallet_topup', escrow: { hasEscrow: false, escrowStatus: 'released' } });
    await Transaction.create({ userId: userB._id, amount: 50, status: 'completed', type: 'wallet_topup', escrow: { hasEscrow: false, escrowStatus: 'released' } });
    await Transaction.create({ userId: userA._id, amount: 25, status: 'completed', type: 'wallet_topup', escrow: { hasEscrow: false, escrowStatus: 'released' } });

    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const res = await request(app)
      .get('/admin/users/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toBeTruthy();
    expect(res.body.summary.totalUsers.value).toBe(3);
    expect(res.body.summary.activeUsers.value).toBe(3);
    expect(Array.isArray(res.body.recentUsers)).toBe(true);
    expect(Array.isArray(res.body.topPayers)).toBe(true);
    const topA = res.body.topPayers.find(r => String(r._id) === String(userA._id));
    expect(topA).toBeTruthy();
    expect(topA.total).toBe(125);
    expect(topA.user.username).toBe('alice');
  });

  test('GET /admin/users enriches docs with stats/filters', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const target = await User.create({
      username: 'user-target',
      email: 'target@example.com',
      phoneNumber: '+123456789',
      roles: ['seller'],
      provider: 'local',
      position: 'Carpenter',
    });
    await Listing.create({ title: { en: 'Sample' }, category: 'Services', condition: 'new', createdBy: target._id });
    await RequestModel.create({ title: { en: 'Need help' }, description: { en: 'desc' }, createdBy: target._id });
    await Wallet.create({ userId: target._id, available: 150, locked: 50 });

    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'user-target', limit: 5 });

    expect(res.statusCode).toBe(200);
    expect(res.body.docs).toHaveLength(1);
    const doc = res.body.docs[0];
    expect(doc.username).toBe('user-target');
    expect(doc.contactMethod).toBe('email');
    expect(doc.numListings).toBe(1);
    expect(doc.numRequests).toBe(1);
    expect(doc.walletTotal).toBe(200);
    expect(doc.occupation).toBe('Carpenter');
  });

  test('POST /admin/users/:id/ban sets banned flag and sends email', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const target = await User.create({ username: 'victim', email: 'victim@example.com' });

    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const resBan = await request(app)
      .post(`/admin/users/${target._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ban: true, reason: 'Fraudulent activity' });

    expect(resBan.statusCode).toBe(200);
    expect(resBan.body.user).toBeTruthy();
    expect(resBan.body.user.active).toBe(false);
    expect(resBan.body.user.suspendReason).toBe('Fraudulent activity');
    expect(sendTemplateEmail).toHaveBeenCalled();

    const fresh = await User.findById(target._id).lean();
    expect(fresh.active).toBe(false);
    expect(fresh.suspendReason).toBe('Fraudulent activity');
  });
});
