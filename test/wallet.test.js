const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const jwt = require('jsonwebtoken');

// Mock Tap service to avoid external calls during tests
jest.mock('../services/tapService', () => ({
  createCharge: jest.fn().mockResolvedValue({ redirect: { url: 'https://fake.checkout/1' }, id: 'sess_1', transaction: { id: 'tx_mock' } })
}));

describe('Wallet topup/webhook flow (unit)', () => {
  let token, user;
  beforeEach(async () => {
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});
    await User.deleteMany({});
    user = await User.create({ username: 'payuser', email: 'pay@example.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: [] } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
  });

  test('POST /wallet/topup returns checkout url (mocked)', async () => {
    const res = await request(app).post('/wallet/topup').set('Authorization', `Bearer ${token}`).send({ amount: 100, redirectUrl: 'https://example.com/ok' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  test('webhook credits wallet', async () => {
    // simulate webhook payload
    process.env.TAP_SECRET_KEY = process.env.TAP_SECRET_KEY || 'test_secret';
    const payload = { data: { id: 'tx123', amount: 100, status: 'paid', metadata: { userId: user._id.toString(), idempotencyKey: 'ik1' } } };
    const raw = JSON.stringify(payload);
    const sig = require('crypto').createHmac('sha256', process.env.TAP_SECRET_KEY).update(raw).digest('hex');
    const res = await request(app).post('/wallet/webhooks/tap').set('Tap-Signature', sig).send(raw);
    expect(res.statusCode).toBe(200);
    const w = await Wallet.findOne({ userId: user._id });
    expect(w).toBeDefined();
    expect(w.available).toBe(100);
  });
});
