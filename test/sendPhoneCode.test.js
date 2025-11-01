// Tests for unified sendPhoneCode handler
// Mocks sendSMS and generateRandomToken from helpers/auth to avoid external calls.
jest.mock('../helpers/auth', () => ({
  sendSMS: jest.fn(async () => true),
  generateRandomToken: jest.fn(() => 'TESTCODE'),
  // include no-op placeholders for other helper exports used elsewhere
  sendVerificationEmail: jest.fn(),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  sendOTPEmail: jest.fn(),
  sendTemplateEmail: jest.fn()
}));

const mongoose = require('mongoose');
const User = require('../models/User');
const Token = require('../models/Token');

const authController = require('../controllers/authController');

describe('sendPhoneCode handler', () => {
  test('returns isNewUser: false for existing verified user (login flow)', async () => {
    // create an existing user
    const phone = '+15550001';
    await User.create({ username: 'existing', phoneNumber: phone, verified: true, active: true, roles: ['User'] });

    const req = { body: { phoneNumber: phone } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await authController.sendPhoneCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const arg = res.json.mock.calls[0][0];
    expect(arg).toHaveProperty('isNewUser', false);
    expect(arg).toHaveProperty('success', true);
  });

  test('returns isNewUser: true for new phone (signup flow)', async () => {
    const phone = '+15550002';
    const req = { body: { phoneNumber: phone } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await authController.sendPhoneCode(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    const arg = res.json.mock.calls[0][0];
    expect(arg).toHaveProperty('isNewUser', true);
    expect(arg).toHaveProperty('success', true);
  });
});
