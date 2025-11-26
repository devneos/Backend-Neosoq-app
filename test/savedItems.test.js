const request = require('supertest');
const app = require('../server');

describe('Saved Items Endpoints', () => {
  test('GET /saved without auth returns 401', async () => {
    const res = await request(app).get('/saved');
    expect(res.status).toBe(401);
  });

  test('POST /saved without auth returns 401', async () => {
    const res = await request(app).post('/saved').send({ itemType: 'listing', itemId: '64a2' });
    expect(res.status).toBe(401);
  });
});
