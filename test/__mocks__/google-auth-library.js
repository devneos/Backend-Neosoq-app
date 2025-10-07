class OAuth2Client {
  constructor() {}
  async verifyIdToken({ idToken, audience }) {
    // Very small mock: accept any token starting with 'valid-' and return payload
    if (!idToken || !idToken.startsWith('valid-')) {
      const err = new Error('Invalid token');
      err.name = 'TokenError';
      throw err;
    }

    // token format: 'valid-<email>-<sub>-<aud>'
    const parts = idToken.split('-');
    const email = parts[1] || 'test@example.com';
    const sub = parts[2] || '12345';
    const aud = parts[3] || (Array.isArray(audience) ? audience[0] : audience);

    return {
      getPayload() {
        return { sub, email, aud, name: 'Test User', picture: '' };
      }
    };
  }
}

module.exports = { OAuth2Client };
