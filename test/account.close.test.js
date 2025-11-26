const request = require('supertest');
const app = require('../server');

describe('Account Close Endpoint', () => {
  test('DELETE /account/close without auth returns 401', async () => {
    const res = await request(app).delete('/account/close');
    expect(res.status).toBe(401);
  });
});
