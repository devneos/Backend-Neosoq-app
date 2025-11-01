const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../server');

describe('Requests API', () => {
  let token;
  beforeEach(async () => {
    const user = await User.create({ username: 'reqUser', email: 'req@test.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: user.roles } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl', { expiresIn: '1h' });
  });

  test('create request - happy path', async () => {
    const res = await request(app)
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Need a logo', description: 'Design a logo for my startup', projectType: 'one-time', pricingType: 'fixed', price: 200 });

    expect(res.statusCode).toBe(201);
    expect(res.body.request).toBeDefined();
    expect(res.body.request.title).toBeDefined();
    expect(res.body.request.title.en).toBeTruthy();
    expect(res.body.request.createdBy).toBeDefined();
  });

  test('create request missing title returns 400', async () => {
    const res = await request(app)
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No title provided' });
    expect(res.statusCode).toBe(400);
  });

  test('get and list request', async () => {
    const create = await request(app)
      .post('/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Build a website' });
    expect(create.statusCode).toBe(201);
    const id = create.body.request._id;

    const get = await request(app).get(`/requests/${id}`);
    expect(get.statusCode).toBe(200);
    expect(get.body.request).toBeDefined();

    const list = await request(app).get('/requests');
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.body.requests)).toBe(true);
  });
});
