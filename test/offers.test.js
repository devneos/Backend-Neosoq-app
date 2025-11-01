const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Listing = require('../models/Listing');

const app = require('../server');

describe('Offers flow', () => {
  let sellerToken, buyerToken, sellerId, buyerId, listingId;

  beforeEach(async () => {
    const seller = await User.create({ username: 'seller', email: 's@example.com' });
    const buyer = await User.create({ username: 'buyer', email: 'b@example.com' });
    sellerId = seller._id; buyerId = buyer._id;
    sellerToken = jwt.sign({ UserInfo: { userId: sellerId, username: seller.username } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
    buyerToken = jwt.sign({ UserInfo: { userId: buyerId, username: buyer.username } }, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');

    // create a listing as seller
    const res = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .field('category', 'bicycles')
      .field('title', 'Sell Bike')
      .field('price', '100');
    listingId = res.body.listing._id;
  });

  test('create offer and accept sets listing to awarded', async () => {
    // buyer creates offer
    const createRes = await request(app)
      .post('/offers')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ listingId, price: 90, proposalText: 'I offer 90' });
    expect(createRes.statusCode).toBe(201);
    const offerId = createRes.body.offer._id;

    // seller accepts
    const acceptRes = await request(app)
      .put(`/offers/${offerId}/accept`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send();
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.offer.status).toBe('accepted');

    // fetch listing and assert status awarded
    const getRes = await request(app).get(`/listings/${listingId}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.listing.status).toBe('awarded');
    expect(getRes.body.listing.awardedOffer).toBe(offerId);
  });

  test('create offer for a request and accept awards the request', async () => {
    // create a request as seller
    const createReq = await request(app)
      .post('/requests')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ title: 'Help me build API' });
    expect(createReq.statusCode).toBe(201);
    const requestId = createReq.body.request._id;

    // buyer creates offer on request
    const createOffer = await request(app)
      .post('/offers')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ requestId, price: 300, proposalText: 'I can do it' });
    expect(createOffer.statusCode).toBe(201);
    const offerId = createOffer.body.offer._id;

    // seller accepts
    const acceptRes = await request(app)
      .put(`/offers/${offerId}/accept`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send();
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.offer.status).toBe('accepted');

    // fetch request and assert awarded
    const getReq = await request(app).get(`/requests/${requestId}`);
    expect(getReq.statusCode).toBe(200);
    expect(getReq.body.request.status).toBe('awarded');
    expect(getReq.body.request.awardedOffer).toBe(offerId);
  });
});
