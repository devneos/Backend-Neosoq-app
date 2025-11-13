const axios = require('axios');

const TAP_BASE = process.env.TAP_BASE_URL || process.env.BASE_URL || 'https://api.tap.company/v2';
const TAP_SECRET = process.env.TAP_SECRET_KEY || '';

// Simple retry helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const createCharge = async ({ amount, currency = 'KWD', reference = '', metadata = {}, redirect = null }) => {
  const url = `${TAP_BASE.replace(/\/$/, '')}/charges`;
  const body = {
    amount,
    currency,
    threeDSecure: true,
    description: 'Wallet Top-up',
    source: { id: 'src_all' },
    reference,
    metadata: metadata || {},
  };
  if (redirect) body.redirect = { url: redirect };

  const headers = {
    Authorization: `Bearer ${TAP_SECRET}`,
    'Content-Type': 'application/json'
  };

  // retry loop for transient network errors
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      const resp = await axios.post(url, body, { headers, timeout: 10000, validateStatus: (s) => s < 500 });
      // Treat 4xx as immediate failure (no retry) but still return body
      return resp.data;
    } catch (e) {
      lastErr = e;
      // if non-transient, break
      const isNetwork = e && (e.code === 'ECONNABORTED' || e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN');
      if (!isNetwork) break;
      // exponential backoff
      await sleep(200 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
};

module.exports = { createCharge };
