const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const RequestModel = require('../models/Request');
const Offer = require('../models/Offer');
const jwt = require('jsonwebtoken');

describe('Admin requests management', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await RequestModel.deleteMany({});
    await Offer.deleteMany({});
  });

  test('requests list and details and approve/reject/delete', async () => {
    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const requester = await User.create({ username: 'requester', email: 'req@example.com', phoneNumber: '5678' });

    const reqDoc = await RequestModel.create({ title: { en: 'Build site' }, description: { en: 'Need a website' }, price: 500, createdBy: requester._id });

    // create some offers
    await Offer.create({ requestId: reqDoc._id, userId: requester._id, price: 450, proposalText: { en: 'I can do it' } });

    const token = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const listRes = await request(app)
      .get('/admin/requests')
      .set('Authorization', `Bearer ${token}`)
      .query({ limit: 10 });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.summary).toBeTruthy();
    expect(listRes.body.docs[0].creatorName).toBe('requester');
    expect(listRes.body.docs[0]).toHaveProperty('escrowFunded');

    const detailRes = await request(app)
      .get(`/admin/requests/${reqDoc._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.body.request.title.en).toBe('Build site');
    expect(detailRes.body.request).toHaveProperty('attachments');
    expect(detailRes.body.request).toHaveProperty('requester');
    expect(Array.isArray(detailRes.body.applicants)).toBe(true);

    // approve
    const approveRes = await request(app)
      .post(`/admin/requests/${reqDoc._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.request.status).toBe('awarded');

    // reject (set closed)
    const rejectRes = await request(app)
      .post(`/admin/requests/${reqDoc._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Nope' });

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.body.request.status).toBe('closed');

    // delete
    const delRes = await request(app)
      .delete(`/admin/requests/${reqDoc._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.message).toBe('deleted');
  });
});
