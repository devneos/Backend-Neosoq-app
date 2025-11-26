const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const jwt = require('jsonwebtoken');

describe('Admin listings management', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Listing.deleteMany({});
    await Offer.deleteMany({});
  });

  test('listings list and details and approve/reject/delete', async () => {
    const admin = await User.create({ username: 'admin', email: 'admin@example.com', roles: ['admin'] });
    const seller = await User.create({ username: 'seller', email: 'seller@example.com', phoneNumber: '1234' });

    const listing = await Listing.create({ category: 'Electronics', title: { en: 'Phone' }, description: { en: 'Good phone' }, price: 100, createdBy: seller._id });

    // create some offers
    await Offer.create({ listingId: listing._id, userId: seller._id, price: 90 });

    const token = jwt.sign({ UserInfo: { userId: admin._id, username: admin.username, roles: ['admin'] } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    const listRes = await request(app)
      .get('/admin/listings')
      .set('Authorization', `Bearer ${token}`)
      .query({ limit: 10 });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.docs[0].sellerName).toBe('seller');

    const detailRes = await request(app)
      .get(`/admin/listings/${listing._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.body.listing.title.en).toBe('Phone');
    expect(Array.isArray(detailRes.body.offers)).toBe(true);

    // approve
    const approveRes = await request(app)
      .post(`/admin/listings/${listing._id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'OK' });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.listing.reviewCompleted).toBe(true);

    // reject (will set status closed)
    const rejectRes = await request(app)
      .post(`/admin/listings/${listing._id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Not good' });

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.body.listing.status).toBe('closed');

    // delete
    const delRes = await request(app)
      .delete(`/admin/listings/${listing._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.message).toBe('deleted');
  });
});
