const request = require('supertest');
const app = require('../server');
const Invite = require('../models/Invite');
const User = require('../models/User');

describe('Staff signup via invite', () => {
  beforeEach(async () => {
    await Invite.deleteMany({});
    await User.deleteMany({});
  });

  test('consume invite and create staff user', async () => {
    // Create invite directly
    const token = 'testtoken123';
    const invite = await Invite.create({
      email: 'newstaff@example.com',
      token,
      roles: ['staff'],
      adminAccess: ['manage_listings'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/auth/staff/complete-signup')
      .send({ token, username: 'newstaff', password: 'supersecurepassword' });

    expect(res.statusCode).toBe(201);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.email).toBe('newstaff@example.com');
    expect(res.body.user.roles).toContain('staff');

    const usedInvite = await Invite.findOne({ token }).lean();
    expect(usedInvite.used).toBe(true);

    const user = await User.findOne({ email: 'newstaff@example.com' }).lean();
    expect(user).toBeTruthy();
    expect(user.roles).toContain('staff');
  });
});
