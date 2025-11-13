const axios = require('axios');

const MF_BASE = process.env.MYFATOORAH_BASE_URL || process.env.MYFATOORAH_BASE || process.env.BASE_URL || '';
const MF_API_KEY = process.env.MYFATOORAH_API_KEY || '';

// Simple retry helper
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * createPayment - wrapper for MyFatoorah payment initiation.
 * This function provides a consistent interface with the existing Tap service
 * used by wallet topup: it returns an object that contains a redirect.url and id.
 *
 * Note: exact MyFatoorah API shapes differ; for local development and tests
 * this implementation attempts a generic POST to the configured base URL and
 * will return the response body. For production, adjust the endpoint and
 * payload to match MyFatoorah's API.
 */
const createPayment = async ({ amount, currency = 'KWD', reference = '', metadata = {}, redirect = null }) => {
  if (!MF_API_KEY || !MF_BASE) {
    throw new Error('MyFatoorah API credentials not configured (MYFATOORAH_API_KEY / MYFATOORAH_BASE_URL)');
  }

  // Use ExecutePayment (gateway) to generate a PaymentURL suitable for
  // redirecting the user to the gateway. This is the gateway-style flow.
  const url = `${MF_BASE.replace(/\/$/, '')}/v2/ExecutePayment`;

  const body = {
    InvoiceValue: amount,
    DisplayCurrencyIso: currency,
    // PaymentMethodId is optional if you have a SessionId (embedded payments).
    PaymentMethodId: metadata?.paymentMethodId,
    CustomerName: metadata?.name || 'Customer',
    CustomerEmail: metadata?.email,
    MobileCountryCode: metadata?.mobileCountryCode,
    CustomerMobile: metadata?.mobile,
    CallBackUrl: redirect || undefined,
    ErrorUrl: metadata?.errorUrl,
    Language: metadata?.language || 'en',
    CustomerReference: reference || undefined,
    InvoiceItems: metadata?.items || undefined,
    WebhookUrl: process.env.MYFATOORAH_WEBHOOK_URL || undefined
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${MF_API_KEY}`
  };

  const maxAttempts = 3;
  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      const resp = await axios.post(url, body, { headers, timeout: 10000, validateStatus: (s) => s < 500 });
      // Normalize response: ExecutePayment returns PaymentURL and InvoiceId
      const data = resp && resp.data ? resp.data : resp;
      const paymentUrl = (data && (data.PaymentURL || data.InvoiceURL)) || (data && data.Data && (data.Data.PaymentURL || data.Data.InvoiceURL));
      const invoiceId = (data && (data.InvoiceId || data.InvoiceID)) || (data && data.Data && (data.Data.InvoiceId || data.Data.InvoiceID));

      return {
        redirect: { url: paymentUrl },
        id: invoiceId,
        raw: data || resp
      };
    } catch (e) {
      lastErr = e;
      const isNetwork = e && (e.code === 'ECONNABORTED' || e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN');
      if (!isNetwork) break;
      await sleep(200 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
};

module.exports = { createPayment };
