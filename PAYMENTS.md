Payments integration — Neosoq Marketplace
=========================================

This document explains the server-side payments feature, the request/response contracts, webhook handling, idempotency behaviour, and how a frontend engineer should integrate with the API. It assumes the project uses MyFatoorah `ExecutePayment` (gateway) as the payment provider.

Overview
--------
- Provider: MyFatoorah ExecutePayment (gateway flow).
- Flow type: Server-initiated checkout session. Server requests a redirect/payment URL from MyFatoorah, then returns the redirect URL to the frontend. The frontend redirects the user to MyFatoorah to complete the payment.

Where to start in this repository
---------------------------------
- Server endpoints (express routes):
  - `POST /wallet/topup` — create a top-up payment (returns a redirect URL).
  - `GET /wallet` — read wallet balance and recent ledger entries.
  - `POST /wallet/withdraw` — request a withdrawal (internal flows handled server-side).
  - Webhook endpoint: `POST /wallet/webhooks/myfatoorah` — used by MyFatoorah to notify payment status changes.

- Implementation files:
  - `services/myfatoorahService.js` — wrapper for calling MyFatoorah ExecutePayment and normalizing the response.
  - `controllers/walletController.js` — handles `topup`, webhook processing, ledger and wallet updates, and idempotency.
  - `routes/walletRoutes.js` — route declarations for wallet operations and webhooks.
  - `models/IdempotencyKey.js` — persists idempotency records to support replaying responses.
  - `models/Ledger.js` / `models/Wallet.js` — ledger and wallet models.
  - `postman/marketplace_payments.postman_collection.json` — Postman collection with examples and a collection-level pre-request script that auto-generates an `idempotencyKey`.

Environment variables
---------------------
- `MYFATOORAH_API_KEY` — API key used to call the ExecutePayment endpoint (sandbox/test key in development).
- `MYFATOORAH_BASE_URL` — the base URL to call, e.g. `https://apitest.myfatoorah.com` (the service appends `/v2/ExecutePayment`).
- `MYFATOORAH_SECRET_KEY` — shared webhook secret used to validate incoming webhook signatures.

High-level sequence (Topup)
---------------------------
1. Frontend requests top-up session from your API:
   - POST /wallet/topup
   - Body: { amount: <number>, redirectUrl: <string> }
   - Include `Authorization: Bearer <token>` and (optional) `Idempotency-Key: <uuid>` header.

2. Server (`/wallet/topup`) validates input, creates an idempotency placeholder (if header present) and calls `services/myfatoorahService.createPayment(...)` which calls MyFatoorah `/v2/ExecutePayment`.

3. MyFatoorah responds with PaymentURL (or InvoiceURL) and InvoiceId. The `services/myfatoorahService.createPayment` returns a normalized object (redirect/id/raw), however the controller currently returns the response shape used by callers:

   {
     "checkoutUrl": "https://payment.myfatoorah/...",
     "sessionId": "<invoice-or-transaction-id>",
     "raw": <full-provider-response>
   }

4. Your controller stores any necessary ledger placeholder and returns the above object to the frontend. The frontend should redirect the user to `checkoutUrl` to complete the payment.

5. After payment, MyFatoorah will POST to your webhook (`/wallet/webhooks/myfatoorah`) with payment status. The webhook validates the signature, then uses idempotency and the ledger system to finalize the wallet/ledger updates.

Idempotency
-----------
- For safe retries and for admin operations, the API supports `Idempotency-Key` as a request header. When present, the controller will create an `IdempotencyKey` document and store the action's response body for future replay.
- Best practices for frontend: generate a UUIDv4 per logical user action and send it as `Idempotency-Key` for non-idempotent endpoints (topup, escrow confirm/release, admin force-release/refund, etc.). The Postman collection includes a pre-request script that auto-generates this key as `idempotencyKey` collection variable.

Webhook verification
--------------------
- The webhook handler expects a signature header (currently implemented as `MyFatoorah-Signature`).
- Verification uses HMAC-SHA256 over the raw request body and the shared `MYFATOORAH_SECRET_KEY`. The server uses a timing-safe comparison when checking the signature.
- Ensure in MyFatoorah portal (or your account settings) that webhooks are configured to POST to `https://<your-server>/wallet/webhooks/myfatoorah` and that the same secret is configured in your environment.

Frontend integration checklist
------------------------------
1. Implement a Topup flow:
   - Call `POST /wallet/topup` with { amount, redirectUrl }.
   - Pass `Authorization: Bearer <token>` header.
   - Optionally include `Idempotency-Key: <uuid>`.
   - Expect a JSON response like:

     {
       "redirect": { "url": "<payment-url>" },
       "id": <invoiceId>,
       "raw": { /* provider response */ }
     }

   - Redirect the browser to `redirect.url` to complete payment.

2. After payment completion, optionally implement a client-side callback or polling flow to confirm payment result, or rely on server-side webhook processing which will finalize wallet balances.

3. Test the flow using the included Postman collection `postman/marketplace_payments.postman_collection.json` (it includes a sample ExecutePayment request and auto-generates `idempotencyKey`).

Important implementation details & edge cases
-------------------------------------------
- Transactions: the server code attempts to use Mongoose sessions/transactions. If the Mongo environment is a single-node in-memory server (as in tests), transactions are not available and the code falls back to non-transactional updates—console warnings like "Transaction numbers are only allowed on a replica set member or mongos" are expected in that environment.
- Duplicate webhooks: webhooks should be idempotent. The webhook handler uses the `IdempotencyKey` store and transactional semantics where available to avoid double-crediting.
- Partial failures: if a ledger write or wallet update fails after a provider reports success, the system will attempt fallback recovery. Review `controllers/walletController.js` for the exact error handling logic.

Testing & Postman
-----------------
- Tests exist under the `test/` directory (Jest). Relevant tests:
  - `test/wallet.test.js` — unit tests for the topup flow.
  - `test/wallet.webhook.e2e.test.js` — end-to-end webhook processing test using fixtures.
- Postman collection: `postman/marketplace_payments.postman_collection.json` contains sample requests and a collection-level `prerequest` script that sets a random `idempotencyKey` variable. Import this into Postman to exercise the API.

External documentation
----------------------
- MyFatoorah API docs (general): https://myfatoorah.readme.io/
- MyFatoorah ExecutePayment (gateway) overview and parameters are detailed on their docs site — see the ExecutePayment section in the MyFatoorah docs for request payload options (InvoiceValue, DisplayCurrencyIso, InvoiceItems, WebhookUrl, PaymentMethodId, etc.).

If something is unclear
-----------------------
If you want me to:
- Add example frontend code (React + fetch) that performs the topup and redirects to MyFatoorah; or
- Add sample webhook verification code or sample webhook event bodies to the Postman collection; or
- Replace the current webhook header name (if your MyFatoorah account uses a different header),
then tell me which option you prefer and I'll add it.

Quick reference
---------------
- Topup endpoint: POST /wallet/topup
- Webhook endpoint: POST /wallet/webhooks/myfatoorah
- Postman collection: `postman/marketplace_payments.postman_collection.json`
- Env vars: `MYFATOORAH_API_KEY`, `MYFATOORAH_BASE_URL`, `MYFATOORAH_SECRET_KEY`

— End of payments guide —
