# Backend — Frontend Integration Guide

This document describes the endpoints, request/response examples, and developer notes for frontend engineers integrating with the Neosoq backend features implemented today.

Base URL
- By default: `http://localhost:3500` (set `baseUrl` in the Postman environment).

Authentication
- All protected routes require an `Authorization: Bearer <JWT>` header. Use the `/auth/login` endpoint to obtain a token.

Environment variables (important)
- `PORT` — server port
- `MONGO_URI` — MongoDB connection string
- `ADMIN_NOTIFICATIONS_USER` — optional ObjectId for system/admin notifications

Endpoints

1) Profile
- PUT `/profile/edit`
- Body (JSON): any of `{ name, photo, phone, address, email, role, bio }`
- Response: `{ user: { ... } }` (updated user, password removed)
- Notes: `role` can be a string or array; it is stored in `roles` on the user document.

2) Saved Items
- POST `/saved`
  - Body: `{ itemType: 'listing'|'request'|'post', itemId: '<id>', meta?: {} }`
  - Response: `201 { saved: { _id, itemType, itemId, meta } }`
- GET `/saved?page=1&limit=20`
  - Query: `page`, `limit` (defaults: page=1, limit=50)
  - Response: `{ saved: [...], page, limit, total }`
- DELETE `/saved/:id`
  - Response: `{ ok: true }`

3) Notifications
- GET `/notifications?page=1&limit=20`
  - Response: `{ notifications: [...], page, limit, total }`
- PUT `/notifications/read`
  - Marks all unread notifications for current user as read. Response: `{ ok: true }`
- DELETE `/notifications/clear`
  - Deletes all notifications for current user. Response: `{ ok: true }`
  - Note: Notifications are created throughout the app (reviews, disputes, offers, chat). See "Notification triggers" below.

4) Reviews
- POST `/reviews`
  - Body: `{ reviewedUserId, rating, text? }`
  - Response: `201 { review }`
  - On success the reviewed user's `rating` and `ratingCount` are updated and a notification is created for the reviewed user.

5) Disputes
- POST `/disputes`
  - Body: `{ accusedUser, issueType, description? }`
  - Response: `201 { dispute }`
  - Notifications: creates a notification for the accused user and an admin notification (if `ADMIN_NOTIFICATIONS_USER` is set).

6) Account
- DELETE `/account/close`
  - Permanently deletes the account and related content. Response: `{ ok: true }`
  - Before document deletion, the server attempts to delete remote files (Cloudinary) for listings, posts, offers, and requests.

Query & Pagination
- Standard pagination: `page` (1-based), `limit` (max 100). Responses include `page`, `limit`, `total`.

WebSocket / Realtime Events
- Socket.IO is available when the server has it installed and running. Controllers check `app.get('io')` before emitting.
- Events used by chat:
  - `join` — join a conversation room (send conversationId)
  - `leave` — leave a conversation room
  - `send_message` — payload `{ conversationId, sender, body, attachments }` — server persists message and emits `message` to room
  - `message` — emitted to room with the created message object

Notification Triggers
- Notifications are created by the following actions (non-exhaustive):
  - Review created -> `review_created` to reviewed user
  - Dispute created -> `dispute_created` to accused + `dispute_reported` to admin
  - Offer created / accepted -> (where applicable) a notification to listing/request owner
  - Chat message -> notification to recipient

Worker & Delivery
- A simple polling worker exists at `workers/notificationWorker.js`.
  - Run with: `node workers/notificationWorker.js` (ensure `.env` and `MONGO_URI` are set)
  - It polls undelivered notifications and sends emails using the project's email helper (`helpers/auth.js`). It marks notifications as delivered or increments `deliveryAttempts` on failure.
- Optional: a Redis-backed persistent queue (Bull/BullMQ) is supported by additional worker code but the dependency may not be installed in this repo by default. To enable persistent queuing, install `bullmq`/`ioredis` (or `bull`) and start Redis. Example using Docker:

```bash
docker run -p 6379:6379 -d redis:7
npm install bullmq ioredis
node workers/notificationQueueWorker.js
```

Testing
- Minimal Jest + Supertest stubs are included in `test/` for the key endpoints. They validate authorization behavior and endpoint availability. For integration tests you should run the app with a test MongoDB (local or in-memory) and set test env vars.

Error Handling
- All endpoints return JSON errors; common patterns:
  - `401` for unauthorized
  - `400` for validation errors
  - `404` for not found
  - `500` for server errors

Contact & Notes
- If you need additional endpoints documented (admin dashboards, listings management, transactions, escrows, promotion plans), I can extend this README and the Postman collection. Tell me which admin modules to prioritize next.
