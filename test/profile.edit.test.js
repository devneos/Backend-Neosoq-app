const request = require('supertest');
const app = require('../server');

describe('Profile Edit Endpoint', () => {
  test('PUT /profile/edit without auth returns 401', async () => {
    const res = await request(app).put('/profile/edit').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});
