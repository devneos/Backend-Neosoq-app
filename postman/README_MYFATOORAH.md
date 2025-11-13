MyFatoorah ExecutePayment integration
=====================================

This project uses MyFatoorah's ExecutePayment endpoint for wallet top-ups and similar payment flows.

Quick notes
- Environment variables
  - MYFATOORAH_API_KEY: Your API key for calling the ExecutePayment endpoint (use the test key for sandbox).
  - MYFATOORAH_BASE_URL: Base URL for MyFatoorah (e.g. https://apitest.myfatoorah.com). The service appends /v2/ExecutePayment.
  - MYFATOORAH_SECRET_KEY: Shared secret used to verify webhook signatures.

- How ExecutePayment is used
  - Server calls POST ${MYFATOORAH_BASE_URL}/v2/ExecutePayment with PascalCase fields (InvoiceValue, CustomerName, CallBackUrl, etc.).
  - MyFatoorah returns a PaymentURL (or InvoiceURL) and an InvoiceId. The `createPayment` service returns a normalized object (redirect/id/raw), but the controller returns the response shape expected by callers. The current controller response is:

    { "checkoutUrl": "<PaymentURL>", "sessionId": "<invoice-or-transaction-id>", "raw": <original response> }

  - The frontend should redirect the user to the `checkoutUrl` to complete payment.

- Webhook verification
  - The webhook handler expects the MyFatoorah signature header (currently `MyFatoorah-Signature`).
  - The signature is verified using HMAC-SHA256 over the raw request body and the `MYFATOORAH_SECRET_KEY`.
  - Ensure your MyFatoorah region/portal sends the signature header and that `MYFATOORAH_SECRET_KEY` is set on the server.

- Postman collection
  - The collection `postman/marketplace_payments.postman_collection.json` includes a collection-level pre-request script that generates a UUID and sets it as the `idempotencyKey` collection variable. Use the `Idempotency-Key` header in requests where idempotency is required.

If you need me to change the header name used for signature verification or include additional ExecutePayment fields (e.g. InvoiceItems, WebhookUrl, PaymentMethodId), tell me which fields to add and I'll update the service/controller and Postman examples.
