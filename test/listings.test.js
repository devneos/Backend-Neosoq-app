const request = require('supertest');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Setup a minimal app using the existing routes
const app = require('../server');

describe('POST /listings', () => {
  let token;
  beforeEach(async () => {
    // create a test user and token
    const user = await User.create({ username: 'testuser', email: 't@test.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: user.roles } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl', { expiresIn: '1h' });
  });

  test('happy path - create listing with allowed file', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'books')
      .field('title', 'Test Book')
      .attach('files', path.join(__dirname, '__fixtures__', 'sample.pdf'));

    expect(res.statusCode).toBe(201);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.title).toBeDefined();
    expect(res.body.listing.title.en).toBe('Test Book');
    expect(res.body.listing.createdBy).toBeDefined();
  });

  test('invalid file type should return 400', async () => {
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${token}`)
      .field('category', 'books')
      .field('title', 'Bad File')
      .attach('files', path.join(__dirname, '__fixtures__', 'bad.txt'));

    expect(res.statusCode).toBe(400);
  });
});
