const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../server');

describe('Reviews API', () => {
  let reviewerToken;
  let reviewedUser;

  beforeEach(async () => {
    const reviewer = await User.create({ username: 'revUser', email: 'rev@test.com' });
    reviewedUser = await User.create({ username: 'reviewed', email: 'target@test.com' });
    const payload = { UserInfo: { userId: reviewer._id, username: reviewer.username, roles: reviewer.roles } };
    reviewerToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl', { expiresIn: '1h' });
  });

  test('create review and update user rating', async () => {
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewedUserId: reviewedUser._id.toString(), rating: 5, text: 'Great work' });

    expect(res.statusCode).toBe(201);
    expect(res.body.review).toBeDefined();

    // fetch user and ensure rating updated
    const updated = await User.findById(reviewedUser._id);
    expect(updated.rating).toBeTruthy();
    expect(updated.ratingCount).toBeGreaterThanOrEqual(1);
  });

  test('create review missing rating returns 400', async () => {
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewedUserId: reviewedUser._id.toString(), text: 'No rating' });
    expect(res.statusCode).toBe(400);
  });
});
