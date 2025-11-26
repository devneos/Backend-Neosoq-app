const request = require('supertest');
const app = require('../server');

describe('Notifications Endpoints', () => {
  test('GET /notifications without auth returns 401', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });

  test('PUT /notifications/read without auth returns 401', async () => {
    const res = await request(app).put('/notifications/read').send({});
    expect(res.status).toBe(401);
  });
});
