
## Models reference — Neosoq Backend

This document summarizes the main Mongoose models used by the Neosoq Marketplace backend, their key fields, relationships, and usage notes. It is meant as a quick reference for frontend and backend engineers.

Common notes
- File uploads: controllers accept multipart/form-data and read uploaded files from `req.files`. Allowed mime types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `image/png`, `image/jpeg`. Max size per file: 10 MB.
- Many models store uploaded file metadata as objects with fields like `filename`, `urlSrc`, `publicId`, `mimeType`, `size`.
- `createdBy` or owner fields store a reference to the `User` who created the document.
- Some endpoints accept `removedFiles` as either a JSON array string (recommended) or a comma-separated string.

### Listing

Purpose: marketplace item posted by a seller.

Key fields (typical)
- `_id` (ObjectId)
- `title` (string or localized object) — the listing title. Controllers accept `title` or localized keys (e.g., `title_en`).
- `description` (string or localized) — human-readable description.
- `category` (string)
- `subCategory` (string)
- `price` (number)
- `quantity` (number)
- `condition` (string) — e.g., `new`, `used`.
- `files` (Array) — attachment objects:
  - `filename` (string)
  - `urlSrc` (string) — Cloudinary (or storage) URL
  - `publicId` (string) — cloud provider id for deletion
  - `mimeType` (string)
  - `size` (number bytes)
- `images` (Array) — optional images (same shape as `files` entries)
- `reviewCompleted` (boolean) — new listings set to `false` until moderator review
- `reviewedBy` / `reviewNotes` / `reviewedAt` — optional moderation metadata
- `createdBy` (ref `User`)
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "64a...",
  "title": "Blue Bicycle",
  "category": "bicycles",
  "subCategory": "mountain",
  "price": 120,
  "quantity": 1,
  "condition": "used",
  "files": [ { "filename":"specs.pdf", "urlSrc":"https://...","publicId":"abc123","mimeType":"application/pdf","size":23456 } ],
  "reviewCompleted": false,
  "createdBy": { "_id":"...", "username":"seller1" },
  "createdAt": "2025-11-01T00:00:00.000Z"
}
```

Notes for clients
- Use multipart/form-data to send attachments under the `files` (recommended) field. The server accepts uploads under any field name and reads `req.files`, but `files` is the recommended convention.
- When updating a listing, include `removedFiles` (JSON array string or comma-separated list) to request deletion of previously uploaded files.

---

### Offer

Purpose: a bid/proposal by a buyer for a listing or request.

Key fields (typical)
- `_id` (ObjectId)
- `listingId` (ObjectId) — optional, when the offer targets a listing
- `requestId` (ObjectId) — optional, when the offer targets a request
- `price` (number)
- `proposalText` (string)
- `files` (Array) — attachment objects (same shape as listing files)
- `status` (string) — `pending`, `accepted`, `withdrawn`, `completed`, etc.
- `createdBy` (ref `User`) — the user who created the offer
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "64b...",
  "listingId": "64a...",
  "price": 95,
  "proposalText": "I can buy this",
  "files": [ { "urlSrc":"https://...","publicId":"p123","filename":"proposal.pdf" } ],
  "status": "pending",
  "createdBy": { "_id": "...", "username": "buyer1" }
}
```

Notes
- When creating an offer, either `listingId` or `requestId` must be provided.
- Attachments are accepted via multipart/form-data under `files`.

---

### Request

Purpose: service request posted by a buyer (requests that sellers can respond to).

Key fields (typical)
- `_id` (ObjectId)
- `title` (string or localized)
- `description` (string)
- `projectType` (string) — e.g., `one-time`, `ongoing`
- `pricingType` (string) — e.g., `fixed`, `hourly`
- `price` (number)
- `attachments` or `files` (Array) — attachment objects
- `createdBy` (ref `User`)
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "64c...",
  "title": "Need a website",
  "description": "Simple 5 page site",
  "projectType": "one-time",
  "pricingType": "fixed",
  "price": 500,
  "attachments": [ { "urlSrc":"https://...","publicId":"xyz123" } ],
  "createdBy": { "_id":"...", "username": "buyer1" }
}
```

Notes
- Controller supports both JSON body requests and multipart form-data (if files attached). For files, use `files` (form-data). If no files, sending JSON is fine.

---

### Review

Purpose: user-to-user rating and feedback.

Key fields (typical)
- `_id` (ObjectId)
- `reviewedUserId` (ObjectId) — the user being reviewed
- `rating` (number) — 1–5
- `text` (string) — optional textual feedback
- `createdBy` (ref `User`) — reviewer
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "64d...",
  "reviewedUserId": "601...",
  "rating": 5,
  "text": "Excellent service",
  "createdBy": { "_id":"...", "username":"buyer1" }
}
```

Notes
- After creating reviews, aggregate recalculation is performed for the reviewed user's average rating.

---

### Dispute

Purpose: report of problematic transactions or users.

Key fields (typical)
- `_id` (ObjectId)
- `accusedUser` (ObjectId) — user being reported
- `issueType` (string) — e.g., `fraud`, `spam`, `policy`
- `description` (string)
- `status` (string) — e.g., `open`, `resolved`
- `createdBy` (ref `User`) — reporter
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "64e...",
  "accusedUser": "602...",
  "issueType": "fraud",
  "description": "Buyer provided fake documents",
  "status": "open",
  "createdBy": { "_id":"...", "username":"reporter1" }
}
```

---

### Token

Purpose: store refresh tokens or long-lived tokens associated with users (server-side token store).

Key fields (typical)
- `_id` (ObjectId)
- `user` (ref `User`)
- `token` (string)
- `expiresAt` (Date) — optional
- `createdAt`

Notes
- Tokens are used by the auth system for refresh/long-lived sessions. For security, tokens should be stored hashed when possible.

---

### User

Purpose: user account.

Key fields (typical)
- `_id` (ObjectId)
- `username` (string)
- `email` (string)
- `password` (string) — hashed (not returned in API responses)
- `phoneNumber` (string)
- `roles` / `isAdmin` flags — optional
- `profile` fields — e.g., `firstName`, `lastName`, `avatar` (file metadata), `bio`
- `verified` / `emailVerified` / `phoneVerified` booleans
- `rating` / `ratingCount` — optional cached aggregates
- `createdAt`, `updatedAt`

Example document
```
{
  "_id": "600...",
  "username": "seller1",
  "email": "seller1@example.com",
  "phoneNumber": "+1234567890",
  "roles": ["user"],
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Security notes
- Never send `password` in API responses. Use access tokens (JWT) for authenticated requests and keep refresh tokens in secure HTTP-only cookies where applicable.

---

If you want, I can:
- add a `postman` environment snippet describing file upload fields and common `removedFiles` examples;
- add a small `models/OVERVIEW.md` linking to each model file and including exact Mongoose schema snapshots (I can extract schema fields directly from the code).

Last updated: 2025-11-01
