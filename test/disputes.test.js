const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../server');

describe('Disputes API', () => {
  let token;
  let accused;
  beforeEach(async () => {
    const creator = await User.create({ username: 'dispCreator', email: 'disp@creator.com' });
    accused = await User.create({ username: 'accused', email: 'accused@user.com' });
    const payload = { UserInfo: { userId: creator._id, username: creator.username, roles: creator.roles } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl', { expiresIn: '1h' });
  });

  test('create, list, get and update dispute', async () => {
    const create = await request(app)
      .post('/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ accusedUser: accused._id.toString(), issueType: 'fraud', description: 'Suspected fraud in offer' });
    expect(create.statusCode).toBe(201);
    const id = create.body.dispute._id;

    const list = await request(app).get('/disputes');
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.body.disputes)).toBe(true);

    const get = await request(app).get(`/disputes/${id}`);
    expect(get.statusCode).toBe(200);
    expect(get.body.dispute).toBeDefined();

    const update = await request(app)
      .put(`/disputes/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved' });
    expect(update.statusCode).toBe(200);
    expect(update.body.dispute.status).toBe('resolved');
  });

  test('create dispute missing fields returns 400', async () => {
    const res = await request(app)
      .post('/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'missing accusedUser and issueType' });
    expect(res.statusCode).toBe(400);
  });
});
