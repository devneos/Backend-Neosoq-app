const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../server');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');

describe('Payment webhook e2e (signature + idempotency) - MyFatoorah preferred', () => {
  let user;
  beforeEach(async () => {
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});
    await User.deleteMany({});
    user = await User.create({ username: 'webuser', email: 'web@example.com' });
    process.env.MYFATOORAH_SECRET_KEY = process.env.MYFATOORAH_SECRET_KEY || 'test_secret';
  });

  test('webhook accepts signed payload and is idempotent on replay', async () => {
    const payload = { data: { id: 'tx_e2e_1', amount: 200, status: 'paid', metadata: { userId: user._id.toString(), idempotencyKey: 'web-ik-1' } } };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', process.env.MYFATOORAH_SECRET_KEY).update(raw).digest('hex');

    const res1 = await request(app).post('/wallet/webhooks/myfatoorah').set('MyFatoorah-Signature', sig).send(raw);
    expect(res1.statusCode).toBe(200);

    const w = await Wallet.findOne({ userId: user._id });
    expect(w.available).toBe(200);

  // Replay same webhook - should not double credit
  const res2 = await request(app).post('/wallet/webhooks/myfatoorah').set('MyFatoorah-Signature', sig).send(raw);
    expect(res2.statusCode).toBe(200);

    const w2 = await Wallet.findOne({ userId: user._id });
    expect(w2.available).toBe(200);
  });
});
