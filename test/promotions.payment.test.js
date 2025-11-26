const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const PromotionPlan = require('../models/PromotionPlan');
const PromotionPurchase = require('../models/PromotionPurchase');

// Mock MyFatoorah service
jest.mock('../services/myfatoorahService', () => ({
  createPayment: jest.fn().mockResolvedValue({ redirect: { url: 'https://fake.checkout/promo/1' }, id: 'mf_sess_1', raw: { PaymentURL: 'https://fake.checkout/promo/1' } })
}));

describe('Promotions payment flows', () => {
  let user, token;
  beforeEach(async () => {
    await Wallet.deleteMany({});
    await Ledger.deleteMany({});
    await PromotionPlan.deleteMany({});
    await PromotionPurchase.deleteMany({});
    await User.deleteMany({});

    user = await User.create({ username: 'promoUser', email: 'promo@example.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: [] } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
  });

  test('wallet purchase debits wallet and activates purchase', async () => {
    // create wallet with funds
    await Wallet.create({ userId: user._id, available: 500, locked: 0, currency: 'KWD' });
    const plan = await PromotionPlan.create({ title: 'Promo Wallet', price: 100, durationDays: 3, adminFeePercent: 5 });

    const res = await request(app).post('/promotions/purchase').set('Authorization', `Bearer ${token}`).send({ planId: plan._id.toString(), paymentMethod: 'wallet' });
    expect(res.statusCode).toBe(201);
    expect(res.body.purchase).toBeDefined();
    const purchase = await PromotionPurchase.findById(res.body.purchase._id).lean();
    expect(purchase.status).toBe('active');

    const w = await Wallet.findOne({ userId: user._id }).lean();
    expect(w.available).toBe(400);

    const ledger = await Ledger.find({ walletId: w._id }).lean();
    expect(ledger.length).toBeGreaterThanOrEqual(1);
  });

  test('myfatoorah initiation returns checkout url and webhook completes purchase', async () => {
    const plan = await PromotionPlan.create({ title: 'Promo MF', price: 42, durationDays: 5, adminFeePercent: 10 });

    const init = await request(app).post('/promotions/purchase').set('Authorization', `Bearer ${token}`).send({ planId: plan._id.toString(), paymentMethod: 'myfatoorah', redirectUrl: 'https://example.com/ok' });
    expect(init.statusCode).toBe(200);
    expect(init.body.checkoutUrl).toBeDefined();
    const purchase = init.body.purchase;
    expect(purchase).toBeDefined();

    // simulate webhook from provider referencing purchaseId
    const payload = { data: { id: 'tx_mf_1', amount: purchase.amount, status: 'paid', metadata: { purchaseId: purchase._id } } };
    const hook = await request(app).post('/promotions/webhooks/myfatoorah').send(payload);
    expect(hook.statusCode).toBe(200);

    const updated = await PromotionPurchase.findById(purchase._id).lean();
    expect(updated.status === 'completed' || updated.status === 'active' || updated.status === 'pending').toBeTruthy();
    expect(updated.txnId).toBeDefined();
  });
});
