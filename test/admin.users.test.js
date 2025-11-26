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
const jwt = require('jsonwebtoken');

describe('Admin users endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Transaction.deleteMany({});
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
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.topPayers).toBeTruthy();
    // topPayers should include userA with total 125
    const found = res.body.topPayers.find(r => String(r._id) === String(userA._id));
    expect(found).toBeTruthy();
    expect(found.total).toBe(125);
  });

  test('GET /admin/users supports skip/limit/sort/fields and returns projection', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const users = [];
    for (let i = 0; i < 10; i++) {
      users.push({ username: `user${i}`, email: `u${i}@ex.com` });
    }
    await User.insertMany(users);

    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    // request skip=3 limit=3 sort by username asc and only username,email fields
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ skip: 3, limit: 3, sortBy: 'username', sortDir: 'asc', fields: 'username,email' });

    expect(res.statusCode).toBe(200);
    expect(res.body.docs).toHaveLength(3);
    expect(res.body.total).toBe(11); // 10 + admin
    expect(res.body.limit).toBe(3);
    // docs should only have username and email keys
    expect(Object.keys(res.body.docs[0])).toEqual(expect.arrayContaining(['username','email']));
    expect(res.body.docs[0].createdAt).toBeUndefined();
  });

  test('POST /admin/users/:id/ban sets banned flag and sends email', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const target = await User.create({ username: 'victim', email: 'victim@example.com' });

    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const resBan = await request(app)
      .post(`/admin/users/${target._id}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ban: true });

    expect(resBan.statusCode).toBe(200);
    expect(resBan.body.user).toBeTruthy();
    expect(resBan.body.user.active).toBe(false);

    const fresh = await User.findById(target._id).lean();
    expect(fresh.active).toBe(false);
  });
});
