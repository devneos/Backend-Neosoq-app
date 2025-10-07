const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Minimal express app wiring the controller route for test
const app = express();
app.use(bodyParser.json());

// Import the controller
const authController = require('../controllers/authController');
app.post('/auth/google', authController.googleLogin);

const User = require('../models/User');

beforeEach(async () => {
  await User.deleteMany({});
});

test('googleLogin creates user when token is valid', async () => {
  const idToken = 'valid-new@example.com-999-aud1';
  const res = await request(app)
    .post('/auth/google')
    .send({ idToken })
    .expect(200);

  expect(res.body.accessToken).toBeDefined();
  expect(res.body.user.email).toBe('new@example.com');
});

test('googleLogin rejects invalid token', async () => {
  const idToken = 'invalid-token';
  const res = await request(app)
    .post('/auth/google')
    .send({ idToken })
    .expect(401);

  expect(res.body.error).toMatch(/invalid|expired/i);
});
