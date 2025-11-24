const request = require('supertest');
// Mock sendTemplateEmail before importing app/controllers
jest.mock('../helpers/auth', () => {
  const original = jest.requireActual('../helpers/auth');
  return {
    ...original,
    sendTemplateEmail: jest.fn(async (email, message, header) => header || 'invite-sent'),
  };
});

const app = require('../server');
const User = require('../models/User');
const Invite = require('../models/Invite');
const jwt = require('jsonwebtoken');

describe('Admin invite flow', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Invite.deleteMany({});
  });

  test('admin can create a staff invite', async () => {
    const adminUser = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const adminToken = jwt.sign({ UserInfo: { userId: adminUser._id, username: adminUser.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const res = await request(app)
      .post('/admin/staff/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'staff@example.com', roles: ['staff'], adminAccess: ['manage_users'] });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/Invite created/i);

    const invite = await Invite.findOne({ email: 'staff@example.com' }).lean();
    expect(invite).toBeTruthy();
    expect(invite.roles).toContain('staff');
    expect(invite.adminAccess).toContain('manage_users');
    expect(invite.used).toBe(false);
  });
});
