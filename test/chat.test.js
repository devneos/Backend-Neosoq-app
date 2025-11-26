const request = require('supertest');
const app = require('../server');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');

describe('Chat REST endpoints', () => {
  let user, token;
  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await ChatMessage.deleteMany({});
    user = await User.create({ username: 'chatuser', email: 'chat@example.com' });
    const payload = { UserInfo: { userId: user._id, username: user.username, roles: [] } };
    token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET || 'abcdefghijkl');
  });

  test('create conversation and post message', async () => {
    const res = await request(app).post('/chat').set('Authorization', `Bearer ${token}`).send({ participants: [user._id.toString()] });
    expect(res.statusCode).toBe(201);
    const conv = res.body.conversation;
    expect(conv).toBeDefined();

    const msgRes = await request(app).post(`/chat/${conv._id}/messages`).set('Authorization', `Bearer ${token}`).send({ body: 'Hello' });
    expect(msgRes.statusCode).toBe(201);
    expect(msgRes.body.message).toBeDefined();

    const msgs = await request(app).get(`/chat/${conv._id}/messages`).set('Authorization', `Bearer ${token}`);
    expect(msgs.statusCode).toBe(200);
    expect(Array.isArray(msgs.body.messages)).toBe(true);
    expect(msgs.body.messages.length).toBeGreaterThanOrEqual(1);
  });
});
