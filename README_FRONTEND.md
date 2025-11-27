# Frontend Integration Guide — Neosoq Platform (November 2025)

This handbook covers every backend surface area the frontend team interacts with—from login all the way to admin dashboards. Pair it with the new Postman collection (`postman/neosoq-detailed.postman_collection.json`) for executable examples and environment presets.

---

## 1. Base URLs & Tooling

| Environment | URL | Notes |
| --- | --- | --- |
| Local | `http://localhost:3500` | default when running `npm run dev` |
| Staging (example) | `https://staging-api.neosoq.com` | set in Postman `baseUrl` variable |
| Production | `https://api.neosoq.com` | HTTPS required for secure cookies |

**Recommended resources**
- **Postman collection**: `postman/neosoq-detailed.postman_collection.json` (grouped folders + sample payloads/responses)
- **Postman environment**: create one per environment with `baseUrl`, `authToken`, `adminToken`
- **Socket.IO debugging**: run backend with `DEBUG=socket.io:*` to trace chat events

---

## 2. Auth Matrix & Session Rules

| Flow | Endpoint(s) | Success payload | Notes |
| --- | --- | --- | --- |
| Phone OTP login | `POST /auth/login/send-code` → `POST /auth/login/verify` | `{ accessToken, refreshToken, user }` (refresh also set as `jwt` cookie) | OTP expires in 5 min; limiter prevents spamming |
| Password signup | `POST /auth/register` → `POST /auth/verify-phone-code` → `POST /auth/complete-signup` | same as OTP login | Accepts localized `name`/`address`; password ≥ 10 chars |
| Staff invite | `POST /admin/staff/invite` (admin) → `POST /auth/staff/complete-signup` | Admin-scoped JWTs | Invite token expires (default 7 days) |
| Google login | `POST /auth/google` | Issued JWTs + user summary | Client sends Google `idToken` |
| Refresh token | `GET /auth/refresh` | New access & refresh tokens | Requires `jwt` cookie; cookie rotated on each call |
| Logout | `POST /auth/logout` | `{ message: 'Logged out' }` | Deletes refresh cookie |

**Headers to remember**
- `Authorization: Bearer <jwt>` for all protected routes
- `Idempotency-Key: <uuid>` (optional but recommended) — wallet, escrow, and promotion purchases also accept `idempotencyKey` in the body
- `Content-Type: application/json` unless uploading files (`multipart/form-data`)

---

## 3. Shared Response Patterns

| Concept | Details |
| --- | --- |
| **Localization** | User-facing copy (`title`, `description`, `proposalText`, `message`, dispute `description`) is stored as `{ en, ar }`. Sending plain strings auto-wraps under `en`. Always expect localized objects in responses. |
| **Pagination** | Query params: `page` (default 1) + `limit` (default 20, max 100). Responses echo `page`, `limit`, plus `total` and sometimes `totalPages`. Admin endpoints may expose `skip`. |
| **Timestamps** | Most list/detail responses include `timeAgo` alongside ISO dates for immediate UI use. |
| **Uploads** | Call `POST /uploads/attach` first (fields: `ownerType`, `ownerId`, optional `descriptions`, `files`). The result’s metadata is passed to listings/requests/offers/posts under `files` and/or `images`. Removal uses `removedFiles` arrays referencing `urlSrc`/filenames. |
| **Notifications** | Created for reviews, disputes, offer events, chat, listing/request approvals, wallet/promotions, etc. Poll via `/notifications` or rely on worker-delivered emails/SMS when configured. |
| **Errors** | `400` (validation), `401` (missing JWT), `402` (phone not verified), `403` (suspended/forbidden), `404` (missing), `409` (duplicates), `500` (server). Controllers log context to stdout. |

---

## 4. Core Feature Surfaces

Below are the most used endpoints. Exact payloads + edge cases live in the Postman collection.

### 4.1 Profiles & Accounts
- `PUT /profile/edit` – send any subset of `{ name, photo, phone, address, email, role, bio }`, returns `{ user }` with password removed.
- `DELETE /account/close` – nukes the account plus listings, requests, offers, posts, follows, chat, wallet, promotions, transactions, idempotency keys, and Cloudinary files. Returns `{ ok: true }` when cascade completes.

### 4.2 Listings & Requests
| Endpoint | Purpose | Sample request | Sample response |
| --- | --- | --- | --- |
| `POST /listings` | Create localized listing | `{ "category": "Electronics", "title": { "en": "iPhone 14 Pro" }, "price": 320, "files": [] }` | `{ "listing": { "_id": "...", "status": "open", "title": { "en": "iPhone 14 Pro" }, "timeAgo": "just now" } }` |
| `GET /listings` | Search/filter | `/listings?search=iphone&minPrice=100&maxPrice=500&page=1&limit=20` | `{ "listings": [ { "_id": "...", "seller": { "username": "Ayesha" }, "offersCount": 2 } ], "totalCount": 5, "totalPages": 1 }` |
| `PUT /listings/:id` | Owner update | `{ "price": 310, "removedFiles": ["https://cdn/.../spec.pdf"] }` | `{ "listing": { "_id": "...", "price": 310 } }` |
| `POST /requests` | Buyer brief | `{ "title": "Need bilingual landing page", "pricingType": "fixed", "price": 600 }` | `{ "request": { "_id": "...", "status": "open" } }` |
| `GET /requests` | Public briefs | `/requests?page=1&limit=20` | `{ "requests": [...], "page": 1, "limit": 20 }` |

### 4.3 Offers
- `POST /offers` – Body must include `listingId` or `requestId`, plus `price` (and optional `quantity`, `proposalText`, `files`). Response `{ offer }`.
- `PUT /offers/:id` – Owner updates price/proposal attachments.
- `PUT /offers/:id/withdraw` – Sets `status: 'withdrawn'`.
- `PUT /offers/:id/accept` – Listing/request owner accepts; backend marks parent `status: 'awarded'` and notifies bidder.
- `PUT /offers/:id/complete` – Either party marks work complete.
- `GET /offers?listingId=...` (or `requestId`) – `{ "new": [...], "offers": [...] }` where `new` = latest 3 entries.

### 4.4 Posts & Feed
- `POST /posts` – `{ message, files? }` (message localized automatically).
- `GET /posts?page=&limit=` – Public timeline.
- `PUT /posts/:id` / `DELETE /posts/:id` – Owner management (same attachment semantics).
- `GET /feed?page=&limit=` – Aggregated stream returning `{ type: 'listing'|'request'|'post', payload, timeAgo }`.

### 4.5 Social Graph & Saved Items
- `POST /saved` – `{ itemType: 'listing'|'request'|'post', itemId, meta? }`. Upserts per `(userId,itemType,itemId)`.
- `GET /saved?page=&limit=` – Pagination metadata + `total`.
- `DELETE /saved/:savedId` – Remove entry.
- `POST /follow/:userId` / `DELETE /follow/:userId` – Follow/unfollow, increments counters.
- `DELETE /follow/:userId/follower` – Remove a follower.
- `GET /follow/:userId/{followers|following}` – Paginated with populated mini profiles.

### 4.6 Reviews & Disputes
- `POST /reviews` – `{ reviewedUserId, rating (1-5), text? }`; localized text stored; user’s average recalculated.
- `GET /reviews/user/:userId` – Review list.
- `POST /disputes` – `{ accusedUser, issueType, description? }`; notifies accused + admin channel.
- `GET /disputes`, `GET /disputes/:id`, `PUT /disputes/:id`, `DELETE /disputes/:id` – Used by trust & safety dashboard.

### 4.7 Notifications
- `GET /notifications?page=&limit=` – In-app inbox with `read` flag.
- `PUT /notifications/read` – Mark all as read.
- `DELETE /notifications/clear` – Bulk delete.

### 4.8 Uploads
- `POST /uploads/attach` (multipart) – Fields: `ownerType`, `ownerId`, optional `descriptions` (JSON string aligning to files), plus `files`. Only pdf/docx/png/jpeg ≤ 10 MB. Response `{ success: true, files: [ { filename, mimeType, urlSrc, publicId, description } ] }`.

### 4.9 Chat & Realtime

| HTTP endpoint | Purpose |
| --- | --- |
| `POST /chat` | Create conversation. Body `{ participants: [userIdA, userIdB], title? }` → `{ conversation }`. |
| `GET /chat` | List conversations for current user, sorted by `updatedAt`. |
| `GET /chat/:id/messages?page=&limit=&before=&after=` | Paginated messages with `total` + `hasMore`. |
| `POST /chat/:id/messages` | Send message. Body `{ body, attachments?: [{ url, filename }] }`; response `{ message }` and Socket.IO `message` broadcast. |
| `PUT /chat/:id/read` | Mark entire conversation read. |
| `PUT /chat/:id/messages/:messageId/read` | Mark specific message read. |

Socket.IO (room = `conversationId`):
1. `join` / `leave`
2. `send_message` `{ conversationId, sender, body, attachments }`
3. Server emits `message` with persisted payload; notifications created for other participants.

### 4.10 Wallet & Escrow

**Wallet**
- `POST /wallet/topup` – `{ amount, idempotencyKey?, redirectUrl? }` → `{ checkoutUrl, sessionId, raw }`
- `GET /wallet` – `{ wallet: { available, locked, currency, timeAgo }, ledger: [ ...last 10 entries... ] }`
- `POST /wallet/withdraw` – `{ amount, idempotencyKey? }`; requires `req.user.kycVerified`.
- `POST /wallet/webhooks/myfatoorah` – Provider callback (accepts raw text body; verifies signature when `MYFATOORAH_SECRET_KEY` set).

**Escrow**
- `POST /escrow` – `{ workerId, listingId?, requestId?, offerId?, amount, idempotencyKey? }` locks buyer funds (`available`→`locked`) and stores ledger reference.
- `PUT /escrow/:id/confirm` – Buyer/worker toggle their confirmation flag.
- `POST /escrow/:id/release` – Requires both confirmations; debits buyer locked & credits worker available.
- `PUT /escrow/:id/cancel` – Refunds buyer (locked → available).
- `GET /escrow/:id` – Returns escrow + ledger entries referencing the escrow id.
- Admin-only: `GET /escrow/admin/ledger-audit`, `POST /escrow/:id/force-release`, `POST /escrow/:id/force-refund`.

### 4.11 Promotions
- `GET /promotions` / `GET /promotions/:id` – Public catalog.
- `POST /promotions/purchase` – `{ planId, paymentMethod: 'wallet'|'myfatoorah', idempotencyKey? }`. Wallet flow activates instantly; MyFatoorah returns checkout URL.
- `POST /promotions/webhooks/myfatoorah` – Marks purchases `completed`, creates `Transaction` doc, and notifies user.

### 4.12 User Aggregations
- `GET /users/:id/listings`
- `GET /users/:id/offers`
- `GET /users/:id/posts`
- `GET /users/:id/requests`

All return `{ user, <resourcePlural>, page, limit, totalCount }` and optionally accept `search`.

---

## 5. Notifications, Workers & Emails
- Notifications triggered for reviews, disputes, offers created/accepted, chat messages, listing/request moderation, promotion purchases, wallet events, and admin actions.
- `workers/notificationWorker.js` polls undelivered notifications and fires transactional emails via helpers in `helpers/auth.js`.
- Redis/BullMQ workers are optional (see comments inside worker files); run `docker run -p 6379:6379 -d redis:7` and install `bullmq`/`ioredis` if persistent queues are needed.
- OTP SMS uses `helpers/auth.sendSMS` (provider configured via environment variables).

---

## 6. Admin Surface Map

| Area | Key routes | Highlights |
| --- | --- | --- |
| Dashboard | `/admin/dashboard/summary`, `/admin/dashboard/transactions` | Counts, totals, last transactions |
| Users | `/admin/users/summary`, `/admin/users`, `/admin/users/:id/ban` | Filtering via query params (`email`, `username`, `role`, `active`, `fields`, `sortBy/sortDir`, `skip`); ban/unban sends best-effort email |
| Listings | `/admin/listings`, `/admin/listings/:id`, `/admin/listings/:id/{approve,reject}`, `DELETE /admin/listings/:id` | Aggregation adds seller info + offer counts; email + in-app notifications on decisions |
| Requests | `/admin/requests`, `/admin/requests/:id`, `/admin/requests/:id/{approve,reject}`, `DELETE /admin/requests/:id` | Responses include applicant snapshots (name, avatar, phone, bid amount) |
| Promotions | `/admin/promotions` (CRUD) + `/admin/promotions/purchases` | Manage plan catalog and inspect purchases (plan + user populated) |
| Staff | `/admin/staff` (list/update/suspend/remove) + `/admin/staff/invite` | Filters roles to `admin|moderator|support`, supports soft-removal |
| Transactions & Payments | `/admin/transactions`, `/admin/transactions/summary`, `/admin/transactions/:id`, `/admin/payments/{wallet-transactions,withdrawal-requests,summary}` | Finance dashboards + payout review |
| Escrow | `/admin/escrow`, `/admin/escrow/:id` + shared force release/refund endpoints | Shows payer/recipient info and ledger slices |
| Analytics | `/admin/analytics/{revenue-trend,monthly-transactions,top-performers,dashboard-cards,category-distribution}` | Accepts `range` presets (`7d`, `30d`, `3mo`, `6mo`, `1y`) or explicit `start/end` |

All admin routes run through `verifyJWT` + `isAdmin`; ensure you store the admin JWT separately (Postman `{{adminToken}}`).

---

## 7. Upload & Attachment Workflow
1. Call `POST /uploads/attach` with `ownerType`, `ownerId`, optional `descriptions`, and actual files (pdf/docx/png/jpeg ≤ 10 MB).
2. Save returned metadata (`filename`, `mimeType`, `urlSrc`, `publicId`, `description`). For image uploads, the server auto-adds URLs to the owner’s `images` array.
3. When editing, pass `removedFiles` (array or JSON string) referencing `urlSrc`, filename, or original filename to trigger deletion. Backend deletes remote assets when `publicId` exists.

---

## 8. Idempotency Guarantees
`middleware/idempotency` uses Mongo to store keys. Provide a unique `Idempotency-Key` header (or include `idempotencyKey` in JSON) for:
- Wallet top-ups & withdrawals
- Escrow creation, force release/refund
- Promotion purchases

If a response was already stored under that key, the server replays it, preventing double charges.

---

## 9. Testing & Debugging Checklist
- Import the Postman collection + environment, set `baseUrl`, `authToken`, `adminToken`.
- Create flow smoke tests:
  1. Register/login user
  2. Create listing → create offer → accept
  3. Top-up wallet → create escrow → confirm + release
  4. Leave reviews/disputes to verify notifications
- For webhooks, point provider callbacks to a tunnel (`ngrok http 3500`) and replay payloads with correct `myfatoorah-signature`.
- Enable verbose logs for tricky scenarios: `DEBUG=socket.io:* NODE_ENV=development node server.js`.

---

## 10. Error / Status Cheatsheet

| HTTP Status | Typical cause | Frontend guidance |
| --- | --- | --- |
| 400 | Missing field (`price`, `category`), invalid OTP, bad file type/size | Validate client payloads, surface helper text |
| 401 | Missing or expired JWT | Re-login or call `/auth/refresh` |
| 402 | Phone not verified | Redirect to OTP verification flow |
| 403 | Account suspended, not owner, admin-only route | Show “Contact support” or guard admin-only UI |
| 404 | Listing/request/offer/dispute missing | Refresh lists, display “Item removed” |
| 409 | Duplicate follow/save/dispute | Treat as success (server returns `{ ok: true }` in many cases) |
| 500 | Unexpected error | Encourage retry, log context, inspect backend console |

---

### Sample Timeline (Listing ➜ Offer ➜ Escrow)
1. Seller uploads assets (`POST /uploads/attach`) and creates listing (`POST /listings`).
2. Buyer sends offer (`POST /offers`).
3. Seller accepts (`PUT /offers/:id/accept`) → listing status becomes `awarded`.
4. Buyer tops up wallet → `POST /escrow` to lock funds.
5. Both parties confirm (`PUT /escrow/:id/confirm` twice).
6. Buyer releases (`POST /escrow/:id/release`) → worker wallet credited; backend notifies both.
7. Optional: both leave feedback (`POST /reviews`) and close the loop.

---

Need an endpoint clarified or a payload extended? Ping backend with the route name—we’ll update both this README and the Postman collection to keep the integration experience smooth. Happy shipping! 🚀
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

**Admin Panel — Endpoints Summary**

All admin routes are protected. Include `Authorization: Bearer <JWT>` where the token belongs to a staff/admin user (the `isAdmin` middleware is applied).

- GET `/admin/dashboard/summary` — Returns counts and recent transactions. Example response: `{ usersCount, listingsCount, requestsCount, revenue, transactionsCount, recentTransactions }`.
- GET `/admin/dashboard/transactions?status=completed&page=1&limit=20` — Filtered transactions for dashboard recent activity. Response: `{ docs: [...], total, page, pages, limit }`.

**Users (Admin)**
- GET `/admin/users/summary` — Returns `totalUsers`, `bannedUsers`, `recentUsers`, `topPayers`.
- GET `/admin/users?email=...&username=...&role=seller&active=true&page=1&limit=20` — List users with filtering, projection and sorting options. Example response: `{ docs: [...], total, page, pages, limit }`.
- POST `/admin/users/:id/ban` — Body `{ ban: true }` to ban (set `active: false`) or unban (`ban: false`). Sends best-effort email to user if `email` exists.

**Listings (Admin)**
- GET `/admin/listings?status=open&category=Electronics&search=phone&page=1&limit=20` — Returns listings with `offersCount` and `seller` info via aggregation.
- GET `/admin/listings/:id` — Returns `listing` plus `offers` array (bidderName, bidderProfileImage, phoneNumber, amount, date, status, proposalText).
- POST `/admin/listings/:id/approve` — Optional body `{ note: '...' }`. Marks reviewCompleted and notifies owner via email + in-app notification.
- POST `/admin/listings/:id/reject` — Body `{ reason: '...' }`. Marks listing closed and notifies owner with reason.
- DELETE `/admin/listings/:id` — Deletes listing and notifies owner.

**Requests (Admin)**
- GET `/admin/requests?status=open&isPromoted=true&page=1&limit=20` — Returns requests with `totalApplications` and `creatorName`.
- GET `/admin/requests/:id` — Returns request details and `applicants` array (name, img, phone, bidAmount, applicationDate, status, coverLetter).
- POST `/admin/requests/:id/approve` — Marks request `awarded` and notifies owner.
- POST `/admin/requests/:id/reject` — Body `{ reason }` — Marks `closed` and notifies owner.
- DELETE `/admin/requests/:id` — Deletes and notifies owner.

**Transactions (Admin)**
- GET `/admin/transactions?status=completed&type=promotion&page=1&limit=20` — Paginated transactions. Response: `{ data: [...], meta: { total, page, limit } }`.
- GET `/admin/transactions/:id` — Transaction detail with `user` info.
- GET `/admin/transactions/summary` — Summary cards for total revenue, pending escrow, failed transactions.

**Escrows (Admin)**
- GET `/admin/escrows?status=held&type=listing&page=1&limit=20` — Paginated escrows.
- GET `/admin/escrows/:id` — Escrow details + `ledgers` (release history) and payer/recipient info.
- POST `/admin/escrows/:id/force-release` — Admin forced release (attempts transactional ledger update; falls back to non-transactional in single-node tests).
- POST `/admin/escrows/:id/force-refund` — Admin forced refund.

**Promotions / Payments / Staff**
- Admin promotion and payment management endpoints exist under `/admin/promotions` and `/admin/payments`. Use similar patterns: filter + pagination + detail endpoints.
- Staff CRUD and suspend endpoints exist under `/admin/staff` (invite flow implemented at `/admin/staff/invite`).

**Chat — End-to-End (detailed)**

HTTP endpoints (REST):
- POST `/chat` — Create conversation. Body: `{ participants: ['<userId1>','<userId2>'], title?: '...' }`. Response: `201 { conversation }`.
- GET `/chat` — List user's conversations. Requires auth. Response: `{ conversations: [...] }`.
- GET `/chat/:id/messages?page=1&limit=50&before=<iso>&after=<iso>` — Paginated messages. Response: `{ messages: [...], page, limit, total, hasMore }`.
- POST `/chat/:id/messages` — Send message. Body: `{ body: 'text', attachments?: [{ url, filename }] }`. Response: `201 { message }` and server will:
  - persist message to `ChatMessage`
  - update Conversation `updatedAt`
  - emit `message` over Socket.IO to room `conversationId` when `io` is available
  - create in-app notifications for other participants
- PUT `/chat/:id/read` — Mark all messages in conversation as read for current user.
- PUT `/chat/:id/messages/:messageId/read` — Mark a single message as read.

WebSocket sequence (Socket.IO):
1. Connect to server and authenticate as needed with the same JWT used for HTTP requests.
2. Join a conversation room: `socket.emit('join', conversationId)`.
3. Send message via socket: `socket.emit('send_message', { conversationId, sender: userId, body, attachments })`.
4. Server persists and emits `message` to room: `io.to(conversationId).emit('message', messageObject)`.
5. Client receives `message`, updates UI; server also creates notification entries (delivered by worker/email).

Attachment shape and validation
- Attachments in REST and socket payloads should be arrays of objects with `{ url, filename, mimeType? }`. The server will store sanitized `{ url, filename }` and persist in `ChatMessage.attachments`.

Notification examples (triggers recap)
- Listing approved/rejected/deleted -> notification to listing owner
- Promotion purchase -> notification to purchaser + owner when promotion activates
- Offer created/accepted -> notification to owner and offer maker
- Chat message -> notification to conversation participants

Examples & Query Tips
- Pagination: `page` (1-based) and `limit` (max 100) are supported. For some admin endpoints `skip` and `limit` are also supported.
- Filtering: Use query params per-controller. Examples are included in the Postman collection.

If you'd like, I will now:
- Expand the Postman collection to add admin groups (`admin/users`, `admin/listings`, `admin/requests`, `admin/transactions`, `admin/escrows`, `admin/promotions`, `admin/staff`) with example requests/responses.
- Add representative Jest tests for a few admin flows (list + detail + ban), and chat flows (create conversation, post message, mark read).

Which of those should I do next? (I can do both.)
