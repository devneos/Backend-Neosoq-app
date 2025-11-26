const request = require('supertest');
const app = require('../server');
const PromotionPlan = require('../models/PromotionPlan');

describe('GET /promotions', () => {
  beforeEach(async () => {
    // ensure at least one plan exists
    await PromotionPlan.create({ title: 'Test Plan', description: 'Testing', price: 5, durationDays: 7, adminFeePercent: 10 });
  });

  test('returns available promotion plans', async () => {
    const res = await request(app).get('/promotions');
    expect(res.statusCode).toBe(200);
    expect(res.body.plans).toBeDefined();
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(1);
    expect(res.body.plans[0].title).toBeDefined();
  });
});
