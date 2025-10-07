const mongoose = require('mongoose');
const User = require('../models/User');

describe('User model', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('can create a user without phoneNumber', async () => {
    const u = await User.create({ username: 'a', email: 'a@example.com' });
    expect(u).toBeDefined();
    expect(u.phoneNumber).toBeUndefined();
  });

  test('unique googleId enforced', async () => {
    await User.create({ username: 'u1', googleId: 'g1' });
    await expect(User.create({ username: 'u2', googleId: 'g1' })).rejects.toThrow();
  });
});
