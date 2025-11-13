const axios = require('axios');

const TAP_BASE = process.env.TAP_BASE_URL || process.env.BASE_URL || 'https://api.tap.company/v2';
const TAP_SECRET = process.env.TAP_SECRET_KEY || '';

// Simple retry helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));




// Tap service removed — kept as a deprecated stub to avoid accidental requires
// Please use services/myfatoorahService.js (createPayment) instead.
module.exports = {
  createCharge: async () => {
    throw new Error('Tap service removed; use MyFatoorah (createPayment) instead');
  }
};
module.exports = { createCharge };
