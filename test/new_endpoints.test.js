const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SavedItem = require('../models/SavedItem');
const Notification = require('../models/Notification');
const Listing = require('../models/Listing');

// Mock cloudinary helper before requiring the app so controllers import the mock
const cloudPath = require.resolve('../helpers/cloudinary');
jest.doMock(cloudPath, () => ({
  destroyFile: jest.fn(async (id) => ({ result: 'ok', id })),
  uploadFile: jest.fn(),
  cloudinary: {}
}));
const { destroyFile } = require(cloudPath);
const app = require('../server');

describe('New endpoints: profile, saved, notifications, account close', () => {
  let user, token;
  beforeEach(async () => {
    await User.deleteMany({});
    await SavedItem.deleteMany({});
    await Notification.deleteMany({});
    await Listing.deleteMany({});
    user = await User.create({ username: 'testuser', email: 'test@example.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: [] } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
  });

  test('PUT /profile/edit updates profile fields', async () => {
    const res = await request(app)
      .put('/profile/edit')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'NewName', photo: 'http://img', phone: '12345', address: 'Here', email: 'new@example.com', bio: 'hello' });
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe('NewName');
    expect(res.body.user.profileImage).toBe('http://img');
    expect(res.body.user.phoneNumber).toBe('12345');
    expect(res.body.user.address).toBe('Here');
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.bio).toBe('hello');
  });

  const mongoose = require('mongoose');
  test('POST/GET/DELETE /saved works for saving items', async () => {
    const oid = new mongoose.Types.ObjectId();
    const postRes = await request(app)
      .post('/saved')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemType: 'listing', itemId: oid.toString(), meta: { title: 'X' } });
    expect([200, 201]).toContain(postRes.statusCode);
    expect(postRes.body.saved || postRes.body.ok).toBeDefined();

    const getRes = await request(app).get('/saved').set('Authorization', `Bearer ${token}`);
    expect(getRes.statusCode).toBe(200);
    expect(Array.isArray(getRes.body.saved)).toBe(true);
    expect(getRes.body.total).toBeGreaterThanOrEqual(1);

    const id = (postRes.body.saved && postRes.body.saved._id) || (await SavedItem.findOne({ userId: user._id }))._id;
    const delRes = await request(app).delete(`/saved/${id}`).set('Authorization', `Bearer ${token}`);
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.ok).toBe(true);
  });

  test('GET /notifications and PUT /notifications/read mark notifications as read', async () => {
    // create a notification for this user
    await Notification.create({ userId: user._id, actorId: user._id, type: 'test', title: 't', body: 'b', read: false });
    const g = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(g.statusCode).toBe(200);
    expect(g.body.notifications.length).toBeGreaterThanOrEqual(1);

    const r = await request(app).put('/notifications/read').set('Authorization', `Bearer ${token}`);
    expect(r.statusCode).toBe(200);
    const after = await Notification.findOne({ userId: user._id });
    expect(after.read).toBe(true);
  });

  test('DELETE /account/close deletes user and calls destroyFile for content', async () => {
    // insert a listing document with a file that has publicId using raw collection insert
    await Listing.collection.insertOne({ category: 'c', title: { en: 't' }, description: { en: 'd' }, createdBy: user._id, files: [{ publicId: 'pub_1' }], createdAt: new Date(), updatedAt: new Date() });

    // ensure mock destroyFile is used (controllers import the mocked module)
    destroyFile.mockClear();

    const res = await request(app).delete('/account/close').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const foundUser = await User.findById(user._id);
    expect(foundUser).toBeNull();
    const foundListings = await Listing.find({ createdBy: user._id });
    expect(foundListings.length).toBe(0);
    expect(destroyFile).toHaveBeenCalledWith('pub_1');
  });
});
