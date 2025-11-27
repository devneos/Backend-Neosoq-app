const fs = require('fs');
const path = require('path');

const fmt = (obj) => JSON.stringify(obj, null, 2);

const describe = (summary, sampleReq, sampleRes, notes = []) => {
  let text = summary.trim();
  if (notes.length) {
    text += '\n\nNotes:\n- ' + notes.join('\n- ');
  }
  if (sampleReq) {
    text += '\n\nSample Request:\n' + sampleReq;
  }
  if (sampleRes) {
    text += '\n\nSample Response:\n' + sampleRes;
  }
  return text;
};

const buildUrl = (pathStr, query = []) => {
  const clean = pathStr.replace(/^\//, '');
  const segments = clean ? clean.split('/') : [];
  const url = {
    raw: `{{baseUrl}}${clean ? '/' + clean : ''}`,
    host: ['{{baseUrl}}'],
    path: segments,
  };
  if (query.length) {
    url.query = query;
  }
  return url;
};

const makeRequest = (def) => {
  const headers = def.headers ? [...def.headers] : [];
  const request = {
    method: def.method,
    url: buildUrl(def.path, def.query || []),
    description: def.description || '',
  };

  const authType = def.auth || 'user';
  if (authType === 'user') {
    request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{authToken}}', type: 'string' }],
    };
  } else if (authType === 'admin') {
    request.auth = {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }],
    };
  }

  if (def.body) {
    if (!def.bodyType || def.bodyType === 'json') {
      if (!headers.find((h) => h.key.toLowerCase() === 'content-type')) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
      }
      request.body = { mode: 'raw', raw: typeof def.body === 'string' ? def.body : fmt(def.body) };
    } else if (def.bodyType === 'text') {
      headers.push({ key: 'Content-Type', value: def.textContentType || 'text/plain' });
      request.body = { mode: 'raw', raw: def.body };
    } else if (def.bodyType === 'formdata') {
      request.body = { mode: 'formdata', formdata: def.body };
    }
  }

  if (headers.length) {
    request.header = headers;
  }

  return {
    name: def.name,
    request,
  };
};

const makeSection = (name, description, requests) => ({
  name,
  description,
  item: requests.map(makeRequest),
});

const sections = [];

sections.push(
  makeSection('Authentication', 'Phone OTP, email/password, and Google sign-in flows.', [
    {
      name: 'Send Login Code (Phone OTP)',
      method: 'POST',
      path: '/auth/login/send-code',
      auth: 'none',
      body: { phoneNumber: '+96512345678' },
      description: describe(
        'Kick off phone-based login or signup by sending a 6-digit OTP. Existing verified users can log in; new phones receive a verification code with `isNewUser: true` in the controller response.',
        fmt({ phoneNumber: '+96512345678' }),
        fmt({ message: 'Login verification code sent successfully', success: true })
      ),
    },
    {
      name: 'Verify Login Code',
      method: 'POST',
      path: '/auth/login/verify',
      auth: 'none',
      body: { phoneNumber: '+96512345678', verificationCode: '123456' },
      description: describe(
        'Validate the OTP and receive short-lived access token plus refresh token (also set as `jwt` cookie).',
        fmt({ phoneNumber: '+96512345678', verificationCode: '123456' }),
        fmt({
          accessToken: '<access-jwt>',
          refreshToken: '<refresh-jwt>',
          user: { id: '64f0d1...', username: 'ayesha', phoneNumber: '+96512345678', verified: true, roles: ['User'] },
        })
      ),
    },
    {
      name: 'Register (Email + Password)',
      method: 'POST',
      path: '/auth/register',
      auth: 'none',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        country: 'Kuwait',
        region: 'Ahmadi',
        phone: '+96522223344',
        password: 'Str0ngPass!@#',
      },
      description: describe(
        'Create a basic account with email/password. Backend hashes the password, stores roles, and emails an OTP.',
        fmt({
          name: 'John Doe',
          email: 'john@example.com',
          country: 'Kuwait',
          region: 'Ahmadi',
          phone: '+96522223344',
          password: 'Str0ngPass!@#',
        }),
        fmt({ status: 200, message: 'Registered Successfully' }),
        ['Password must be at least 10 characters.']
      ),
    },
    {
      name: 'Verify Phone Code (Signup)',
      method: 'POST',
      path: '/auth/verify-phone-code',
      auth: 'none',
      body: { phoneNumber: '+96522223344', token: '891234' },
      description: describe(
        'Confirm SMS verification for new accounts before allowing full signup.',
        fmt({ phoneNumber: '+96522223344', token: '891234' }),
        fmt({ success: true, message: 'Phone verified' })
      ),
    },
    {
      name: 'Complete Signup',
      method: 'POST',
      path: '/auth/complete-signup',
      auth: 'none',
      body: {
        phoneNumber: '+96522223344',
        username: 'johnny',
        password: 'Str0ngPass!@#',
        inviteToken: null,
      },
      description: describe(
        'Finish onboarding after phone verification (and optional invite). Returns tokens identical to `/auth/login/verify`.',
        fmt({ phoneNumber: '+96522223344', username: 'johnny', password: 'Str0ngPass!@#', inviteToken: null }),
        fmt({ accessToken: '<access>', refreshToken: '<refresh>', user: { id: '64f0d1...', username: 'johnny', roles: ['User'] } })
      ),
    },
    {
      name: 'Complete Staff Signup',
      method: 'POST',
      path: '/auth/staff/complete-signup',
      auth: 'none',
      body: {
        token: 'invite-token-from-email',
        name: 'Support Lead',
        password: 'Sup3rSecure!!',
      },
      description: describe(
        'Consume an invite created via `/admin/staff/invite` to create staff/admin accounts.',
        fmt({ token: 'invite-token-from-email', name: 'Support Lead', password: 'Sup3rSecure!!' }),
        fmt({ message: 'Staff account created', accessToken: '<access>', refreshToken: '<refresh>' })
      ),
    },
    {
      name: 'Google Login (Token Sign-In)',
      method: 'POST',
      path: '/auth/google',
      auth: 'none',
      body: { idToken: '<google-id-token>' },
      description: describe(
        'Verify a Google ID token server-side and issue platform JWTs.',
        fmt({ idToken: '<google-id-token>' }),
        fmt({ accessToken: '<access>', refreshToken: '<refresh>', user: { id: '64f0d1...', email: 'john@example.com' } })
      ),
    },
    {
      name: 'Refresh Access Token',
      method: 'GET',
      path: '/auth/refresh',
      auth: 'none',
      description: describe(
        'Exchange the `jwt` cookie refresh token for a new access token (and rotated refresh token in cookie and response).',
        null,
        fmt({ accessToken: '<new-access>', refreshToken: '<new-refresh>' }),
        ['Requires `jwt` cookie to be sent; Postman automatically stores cookies per domain.']
      ),
    },
    {
      name: 'Logout',
      method: 'POST',
      path: '/auth/logout',
      auth: 'none',
      description: describe(
        'Clears the refresh cookie server-side.',
        null,
        fmt({ message: 'Logged out' })
      ),
    },
  ])
);

sections.push(
  makeSection('Profile & Account', 'User profile editing and destructive account operations.', [
    {
      name: 'Edit Profile',
      method: 'PUT',
      path: '/profile/edit',
      body: { name: 'Ayesha', photo: 'https://cdn.example.com/avatar.jpg', phone: '+96511112222', bio: 'Product designer' },
      description: describe(
        'Update mutable profile fields. `role` can be a string or array and maps to `roles` in Mongo.',
        fmt({ name: 'Ayesha', photo: 'https://cdn.example.com/avatar.jpg', phone: '+96511112222', bio: 'Product designer' }),
        fmt({ user: { id: '64fd...', username: 'Ayesha', phoneNumber: '+96511112222', profileImage: 'https://cdn.example.com/avatar.jpg' } })
      ),
    },
    {
      name: 'Close Account Permanently',
      method: 'DELETE',
      path: '/account/close',
      body: null,
      description: describe(
        'Deletes the account plus listings, requests, offers, posts, chats, notifications, wallet, transactions, promotion purchases, and remote files.',
        null,
        fmt({ ok: true }),
        ['Operation cannot be undone. Ensure user explicitly confirms before calling.']
      ),
    },
  ])
);

sections.push(
  makeSection('Listings', 'Marketplace listings CRUD (+ search).', [
    {
      name: 'Create Listing',
      method: 'POST',
      path: '/listings',
      body: {
        category: 'Electronics',
        subCategory: 'Phones',
        title: { en: 'iPhone 14 Pro 256GB', ar: 'ايفون ١٤ برو ٢٥٦ جي بي' },
        description: 'Factory unlocked, midnight purple.',
        price: 320,
        quantity: 1,
        condition: 'new',
        files: [],
        images: ['https://cdn.example.com/iphone.jpg'],
      },
      description: describe(
        'Creates a localized listing. `title`/`description` accept plain strings or `{en, ar}` objects. Attachments should be uploaded first via `/uploads/attach` and passed as metadata in `files`/`images`.',
        fmt({
          category: 'Electronics',
          subCategory: 'Phones',
          title: { en: 'iPhone 14 Pro 256GB', ar: 'ايفون ١٤ برو ٢٥٦ جي بي' },
          description: 'Factory unlocked, midnight purple.',
          price: 320,
          quantity: 1,
          condition: 'new',
          files: [],
          images: ['https://cdn.example.com/iphone.jpg'],
        }),
        fmt({
          listing: {
            _id: '6501...',
            category: 'Electronics',
            title: { en: 'iPhone 14 Pro 256GB', ar: 'ايفون ١٤ برو ٢٥٦ جي بي' },
            status: 'open',
            price: 320,
            files: [],
            images: ['https://cdn.example.com/iphone.jpg'],
            timeAgo: 'a few seconds ago',
          },
        })
      ),
    },
    {
      name: 'List Listings (Search & Filter)',
      method: 'GET',
      path: '/listings',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'search', value: 'iphone' },
        { key: 'minPrice', value: '100' },
        { key: 'maxPrice', value: '500' },
      ],
      description: describe(
        'Supports filtering by `category`, `subCategory`, `status`, `condition`, `minPrice`, `maxPrice`, and fuzzy `search` on English title/description.',
        null,
        fmt({
          listings: [
            {
              _id: '6501...',
              title: { en: 'iPhone 14 Pro 256GB', ar: '' },
              price: 320,
              status: 'open',
              seller: { id: '64fd...', username: 'Ayesha', rating: 4.9 },
              offersCount: 2,
              timeAgo: '5m',
            },
          ],
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
        })
      ),
    },
    {
      name: 'Get Listing Details',
      method: 'GET',
      path: '/listings/6501abcdef1234567890abcd',
      auth: 'none',
      description: describe(
        'Returns localized title/description plus seller snapshot and offer count.',
        null,
        fmt({
          listing: {
            _id: '6501abcdef1234567890abcd',
            title: { en: 'iPhone 14 Pro 256GB', ar: '' },
            description: { en: 'Factory unlocked, midnight purple.', ar: '' },
            price: 320,
            status: 'open',
            seller: { id: '64fd...', username: 'Ayesha', rating: 4.9, ratingCount: 120 },
            offersCount: 2,
            timeAgo: '5m',
          },
        })
      ),
    },
    {
      name: 'Update Listing',
      method: 'PUT',
      path: '/listings/6501abcdef1234567890abcd',
      body: {
        title: 'iPhone 14 Pro (Midnight Purple)',
        price: 310,
        removedFiles: ['https://cdn.example.com/spec.pdf'],
      },
      description: describe(
        'Owner-only update. `removedFiles` can be an array or JSON string referencing file URLs/filenames to delete; pass new attachments through `/uploads/attach` and include metadata in `files`.',
        fmt({
          title: 'iPhone 14 Pro (Midnight Purple)',
          price: 310,
          removedFiles: ['https://cdn.example.com/spec.pdf'],
        }),
        fmt({
          listing: {
            _id: '6501abcdef1234567890abcd',
            title: { en: 'iPhone 14 Pro (Midnight Purple)', ar: '' },
            price: 310,
            status: 'open',
            timeAgo: 'just now',
          },
        })
      ),
    },
    {
      name: 'Delete Listing',
      method: 'DELETE',
      path: '/listings/6501abcdef1234567890abcd',
      body: null,
      description: describe(
        'Owner-only deletion. Server cleans up Cloudinary files where `publicId` exists.',
        null,
        fmt({ success: true })
      ),
    },
  ])
);

sections.push(
  makeSection('Requests (Buyer Briefs)', 'Service requests with localized content.', [
    {
      name: 'Create Request',
      method: 'POST',
      path: '/requests',
      body: {
        title: 'Need a bilingual landing page',
        description: { en: 'Simple marketing site', ar: 'موقع تسويقي بسيط' },
        projectType: 'one-time',
        pricingType: 'fixed',
        price: 600,
        files: [],
      },
      description: describe(
        'Creates a buyer brief. Works the same as listings for localization and attachments.',
        fmt({
          title: 'Need a bilingual landing page',
          description: { en: 'Simple marketing site', ar: 'موقع تسويقي بسيط' },
          projectType: 'one-time',
          pricingType: 'fixed',
          price: 600,
          files: [],
        }),
        fmt({
          request: {
            _id: '6502...',
            title: { en: 'Need a bilingual landing page', ar: 'موقع تسويقي بسيط' },
            price: 600,
            status: 'open',
            timeAgo: 'seconds ago',
          },
        })
      ),
    },
    {
      name: 'List Requests',
      method: 'GET',
      path: '/requests',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Returns localized `title`/`description`, paginated by `page`/`limit`.',
        null,
        fmt({
          requests: [
            {
              _id: '6502...',
              title: { en: 'Need a bilingual landing page', ar: '' },
              pricingType: 'fixed',
              price: 600,
              timeAgo: '2m',
            },
          ],
          page: 1,
          limit: 20,
        })
      ),
    },
    {
      name: 'Get Request',
      method: 'GET',
      path: '/requests/6502abcdef1234567890cdef',
      auth: 'none',
      description: describe(
        'Returns the request with localized fields and `timeAgo`.',
        null,
        fmt({
          request: {
            _id: '6502abcdef1234567890cdef',
            title: { en: 'Need a bilingual landing page', ar: '' },
            description: { en: 'Simple marketing site', ar: '' },
            price: 600,
            status: 'open',
            timeAgo: '2m',
          },
        })
      ),
    },
    {
      name: 'Update Request',
      method: 'PUT',
      path: '/requests/6502abcdef1234567890cdef',
      body: {
        status: 'awarded',
        removedFiles: ['https://cdn.example.com/rfp.pdf'],
        files: [],
      },
      description: describe(
        'Owner-only update. Accepts `removedFiles` and new `files` metadata like listings.',
        fmt({ status: 'awarded', removedFiles: ['https://cdn.example.com/rfp.pdf'], files: [] }),
        fmt({ request: { _id: '6502abcdef1234567890cdef', status: 'awarded' } })
      ),
    },
    {
      name: 'Delete Request',
      method: 'DELETE',
      path: '/requests/6502abcdef1234567890cdef',
      body: null,
      description: describe(
        'Owner-only deletion. Removes Cloudinary files where possible.',
        null,
        fmt({ success: true })
      ),
    },
  ])
);

sections.push(
  makeSection('Offers', 'Bids on listings or requests.', [
    {
      name: 'Create Offer',
      method: 'POST',
      path: '/offers',
      body: {
        listingId: '6501abcdef1234567890abcd',
        price: 290,
        quantity: 1,
        proposalText: 'I can deliver in 2 days.',
        files: [],
      },
      description: describe(
        'Submit an offer against either a listing or a request (one of `listingId`, `requestId` is required). `proposalText` is localized automatically.',
        fmt({ listingId: '6501abcdef1234567890abcd', price: 290, quantity: 1, proposalText: 'I can deliver in 2 days.', files: [] }),
        fmt({
          offer: {
            _id: '6503...',
            listingId: '6501abcdef1234567890abcd',
            price: 290,
            status: 'pending',
            proposalText: { en: 'I can deliver in 2 days.', ar: '' },
            timeAgo: 'a few seconds ago',
          },
        })
      ),
    },
    {
      name: 'Update Offer',
      method: 'PUT',
      path: '/offers/6503abcdef1234567890abcd',
      body: {
        price: 285,
        proposalText: { en: 'I can bundle accessories too.' },
        removedFiles: [],
        files: [],
      },
      description: describe(
        'Offer owner can adjust price, localized proposal text, and attachments.',
        fmt({ price: 285, proposalText: { en: 'I can bundle accessories too.' }, removedFiles: [], files: [] }),
        fmt({ offer: { _id: '6503abcdef1234567890abcd', price: 285, proposalText: { en: 'I can bundle accessories too.' } } })
      ),
    },
    {
      name: 'Withdraw Offer',
      method: 'PUT',
      path: '/offers/6503abcdef1234567890abcd/withdraw',
      body: null,
      description: describe(
        'Marks offer status as `withdrawn`.',
        null,
        fmt({ offer: { _id: '6503abcdef1234567890abcd', status: 'withdrawn' } })
      ),
    },
    {
      name: 'Accept Offer (Owner)',
      method: 'PUT',
      path: '/offers/6503abcdef1234567890abcd/accept',
      body: null,
      description: describe(
        'Listing/request owner accepts the offer. Backend updates listing/request status to `awarded` and notifies the bidder.',
        null,
        fmt({ offer: { _id: '6503abcdef1234567890abcd', status: 'accepted' } })
      ),
    },
    {
      name: 'Complete Offer',
      method: 'PUT',
      path: '/offers/6503abcdef1234567890abcd/complete',
      body: null,
      description: describe(
        'Marks offer as `completed`. Both parties can trigger depending on workflow.',
        null,
        fmt({ offer: { _id: '6503abcdef1234567890abcd', status: 'completed' } })
      ),
    },
    {
      name: 'List Offers for Listing',
      method: 'GET',
      path: '/offers',
      query: [
        { key: 'listingId', value: '6501abcdef1234567890abcd' },
      ],
      description: describe(
        'Returns `new` (latest three) and `offers` arrays. Use `requestId` to target requests.',
        null,
        fmt({
          new: [
            { _id: '6503...', price: 290, quantity: 1, status: 'pending', timeAgo: '2m' },
          ],
          offers: [
            { _id: '6504...', price: 300, quantity: 1, status: 'pending', timeAgo: '10m' },
          ],
        })
      ),
    },
  ])
);

sections.push(
  makeSection('Posts & Feed', 'Community posts plus aggregated feed.', [
    {
      name: 'Create Post',
      method: 'POST',
      path: '/posts',
      body: {
        message: 'Check out my new workspace setup!',
        files: [],
      },
      description: describe(
        'Creates a localized community post with optional attachments.',
        fmt({ message: 'Check out my new workspace setup!', files: [] }),
        fmt({ post: { _id: '6505...', message: { en: 'Check out my new workspace setup!', ar: '' }, files: [], timeAgo: 'seconds ago' } })
      ),
    },
    {
      name: 'List Posts',
      method: 'GET',
      path: '/posts',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Public posts. `message` is localized and `timeAgo` is included.',
        null,
        fmt({
          posts: [
            { _id: '6505...', message: { en: 'Check out my new workspace setup!', ar: '' }, files: [], timeAgo: '1m' },
          ],
          page: 1,
          limit: 20,
        })
      ),
    },
    {
      name: 'Get Post',
      method: 'GET',
      path: '/posts/6505abcdef1234567890abcd',
      auth: 'none',
      description: describe(
        'Returns a single post with localized message and `timeAgo`.',
        null,
        fmt({ post: { _id: '6505abcdef1234567890abcd', message: { en: 'Check out my new workspace setup!', ar: '' }, files: [], timeAgo: '1m' } })
      ),
    },
    {
      name: 'Update Post',
      method: 'PUT',
      path: '/posts/6505abcdef1234567890abcd',
      body: {
        message: { en: 'Updated caption', ar: '' },
        removedFiles: [],
        files: [],
      },
      description: describe(
        'Owner-only update supporting localized message and attachment management.',
        fmt({ message: { en: 'Updated caption', ar: '' }, removedFiles: [], files: [] }),
        fmt({ post: { _id: '6505abcdef1234567890abcd', message: { en: 'Updated caption', ar: '' } } })
      ),
    },
    {
      name: 'Delete Post',
      method: 'DELETE',
      path: '/posts/6505abcdef1234567890abcd',
      body: null,
      description: describe(
        'Deletes the post and remote files if any.',
        null,
        fmt({ success: true })
      ),
    },
    {
      name: 'Get Feed',
      method: 'GET',
      path: '/feed',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Aggregated feed merging latest listings, requests, and posts by created date. Each item has `type`, `payload`, and `timeAgo`.',
        null,
        fmt({
          items: [
            { type: 'listing', id: '6501...', payload: { title: { en: 'iPhone 14 Pro 256GB' } }, timeAgo: '2m' },
            { type: 'request', id: '6502...', payload: { title: { en: 'Need a bilingual landing page' } }, timeAgo: '5m' },
            { type: 'post', id: '6505...', payload: { message: { en: 'Check out my new workspace setup!' } }, timeAgo: '10m' },
          ],
          page: 1,
          limit: 20,
          totalCount: 123,
          totalPages: 7,
        })
      ),
    },
  ])
);

sections.push(
  makeSection('Reviews & Disputes', 'Trust & safety operations.', [
    {
      name: 'Create Review',
      method: 'POST',
      path: '/reviews',
      body: { reviewedUserId: '6500userabc', rating: 5, text: 'Excellent communication' },
      description: describe(
        'Creates a localized review and recalculates the reviewed user’s aggregate rating.',
        fmt({ reviewedUserId: '6500userabc', rating: 5, text: 'Excellent communication' }),
        fmt({ review: { _id: '6506...', reviewerId: '64fd...', reviewedUserId: '6500userabc', rating: 5, text: { en: 'Excellent communication', ar: '' } } })
      ),
    },
    {
      name: 'List Reviews for User',
      method: 'GET',
      path: '/reviews/user/6500userabc',
      auth: 'none',
      description: describe(
        'Lists reviews created against a user.',
        null,
        fmt({
          reviews: [
            { _id: '6506...', reviewerId: '64fd...', rating: 5, text: { en: 'Excellent communication', ar: '' }, createdAt: '2023-09-12T10:00:00Z' },
          ],
        })
      ),
    },
    {
      name: 'Create Dispute',
      method: 'POST',
      path: '/disputes',
      body: { accusedUser: '6500userxyz', issueType: 'non_delivery', description: 'Item never shipped' },
      description: describe(
        'Files a dispute, notifies both the accused user and admin notification channel.',
        fmt({ accusedUser: '6500userxyz', issueType: 'non_delivery', description: 'Item never shipped' }),
        fmt({ dispute: { _id: '6507...', accusedUser: '6500userxyz', issueType: 'non_delivery', status: 'open' } })
      ),
    },
    {
      name: 'List Disputes',
      method: 'GET',
      path: '/disputes',
      description: describe(
        'Returns all disputes sorted by newest first (primarily for support tooling).',
        null,
        fmt({
          disputes: [
            { _id: '6507...', issueType: 'non_delivery', createdBy: '64fd...', status: 'open' },
          ],
        })
      ),
    },
    {
      name: 'Get Dispute',
      method: 'GET',
      path: '/disputes/6507abcdef1234567890abcd',
      description: describe(
        'Retrieve a single dispute by id.',
        null,
        fmt({ dispute: { _id: '6507abcdef1234567890abcd', issueType: 'non_delivery', description: { en: 'Item never shipped', ar: '' } } })
      ),
    },
    {
      name: 'Update Dispute',
      method: 'PUT',
      path: '/disputes/6507abcdef1234567890abcd',
      body: { status: 'in_review', resolution: 'Requesting more evidence' },
      description: describe(
        'Admins/support can update a dispute. `description` is normalized if sent.',
        fmt({ status: 'in_review', resolution: 'Requesting more evidence' }),
        fmt({ dispute: { _id: '6507abcdef1234567890abcd', status: 'in_review', resolution: 'Requesting more evidence' } })
      ),
    },
    {
      name: 'Delete Dispute',
      method: 'DELETE',
      path: '/disputes/6507abcdef1234567890abcd',
      body: null,
      description: describe(
        'Removes the dispute record (use sparingly).',
        null,
        fmt({ success: true })
      ),
    },
  ])
);

sections.push(
  makeSection('Saved & Follow', 'User-curated content and social graph.', [
    {
      name: 'Add Saved Item',
      method: 'POST',
      path: '/saved',
      body: { itemType: 'listing', itemId: '6501abcdef1234567890abcd', meta: { title: 'iPhone 14 Pro 256GB' } },
      description: describe(
        'Adds (or upserts) a saved listing/request/post for the current user.',
        fmt({ itemType: 'listing', itemId: '6501abcdef1234567890abcd', meta: { title: 'iPhone 14 Pro 256GB' } }),
        fmt({ saved: { _id: '6508...', itemType: 'listing', itemId: '6501abcdef1234567890abcd', meta: { title: 'iPhone 14 Pro 256GB' } } })
      ),
    },
    {
      name: 'List Saved Items',
      method: 'GET',
      path: '/saved',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Paginated saved items sorted DESC by created date.',
        null,
        fmt({
          saved: [
            { _id: '6508...', itemType: 'listing', itemId: '6501...', meta: { title: 'iPhone 14 Pro 256GB' } },
          ],
          page: 1,
          limit: 20,
          total: 5,
        })
      ),
    },
    {
      name: 'Remove Saved Item',
      method: 'DELETE',
      path: '/saved/6508abcdef1234567890abcd',
      body: null,
      description: describe(
        'Removes a saved item by its saved document id.',
        null,
        fmt({ ok: true })
      ),
    },
    {
      name: 'Follow User',
      method: 'POST',
      path: '/follow/6500userxyz',
      body: null,
      description: describe(
        'Current user follows another user; increments follower/following counts.',
        null,
        fmt({ ok: true }),
        ['Returns `{ ok: true }` even if user was already followed (idempotent).']
      ),
    },
    {
      name: 'Unfollow User',
      method: 'DELETE',
      path: '/follow/6500userxyz',
      body: null,
      description: describe(
        'Stops following a user.',
        null,
        fmt({ ok: true })
      ),
    },
    {
      name: 'Remove Follower',
      method: 'DELETE',
      path: '/follow/6500userxyz/follower',
      body: null,
      description: describe(
        'Remove someone who follows the current user.',
        null,
        fmt({ ok: true })
      ),
    },
    {
      name: 'Get Followers',
      method: 'GET',
      path: '/follow/6500userxyz/followers',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Returns paginated followers with populated `follower` mini profile.',
        null,
        fmt({ followers: [{ follower: { _id: '64fd...', username: 'Omar', profileImage: null } }], page: 1, limit: 20 })
      ),
    },
    {
      name: 'Get Following',
      method: 'GET',
      path: '/follow/6500userxyz/following',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Returns accounts the user is following.',
        null,
        fmt({ following: [{ following: { _id: '6501...', username: 'Hassan', profileImage: null } }], page: 1, limit: 20 })
      ),
    },
  ])
);

sections.push(
  makeSection('Notifications', 'Per-user notification inbox.', [
    {
      name: 'Fetch Notifications',
      method: 'GET',
      path: '/notifications',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Returns notifications sorted DESC with pagination metadata.',
        null,
        fmt({
          notifications: [
            { _id: '6509...', type: 'offer_created', title: 'New offer', body: 'You have a new offer on iPhone 14 Pro 256GB', read: false },
          ],
          page: 1,
          limit: 20,
          total: 7,
        })
      ),
    },
    {
      name: 'Mark All Notifications Read',
      method: 'PUT',
      path: '/notifications/read',
      body: null,
      description: describe(
        'Marks all unread notifications as read for the current user.',
        null,
        fmt({ ok: true })
      ),
    },
    {
      name: 'Clear All Notifications',
      method: 'DELETE',
      path: '/notifications/clear',
      body: null,
      description: describe(
        'Deletes every notification for the user.',
        null,
        fmt({ ok: true })
      ),
    },
  ])
);

sections.push(
  makeSection('Uploads', 'Multer-backed file attachments saved to Cloudinary.', [
    {
      name: 'Attach Files',
      method: 'POST',
      path: '/uploads/attach',
      bodyType: 'formdata',
      body: [
        { key: 'ownerType', value: 'listing', type: 'text' },
        { key: 'ownerId', value: '6501abcdef1234567890abcd', type: 'text' },
        { key: 'descriptions', value: JSON.stringify(['Front photo', 'Specs PDF']), type: 'text' },
        { key: 'files', type: 'file', src: '/path/to/photo.jpg' },
        { key: 'files', type: 'file', src: '/path/to/specs.pdf' },
      ],
      description: describe(
        'Uploads files for listings/requests/offers/posts. Each file is uploaded to Cloudinary and appended to the owner record. Only PDF, DOCX, PNG, JPEG (≤10MB) are allowed.',
        'form-data:\nownerType=listing\nownerId=6501abcdef1234567890abcd\ndescriptions=["Front photo","Specs PDF"]\nfiles=@photo.jpg\nfiles=@specs.pdf',
        fmt({
          success: true,
          files: [
            { filename: 'photo.jpg', mimeType: 'image/jpeg', urlSrc: 'https://res.cloudinary.com/.../photo.jpg', publicId: 'listing/1695748123-photo' },
            { filename: 'specs.pdf', mimeType: 'application/pdf', urlSrc: 'https://res.cloudinary.com/.../specs.pdf', publicId: 'listing/1695748123-specs' },
          ],
        })
      ),
    },
  ])
);

sections.push(
  makeSection('Chat', 'Conversation + message endpoints (HTTP counterpart to Socket.IO).', [
    {
      name: 'Create Conversation',
      method: 'POST',
      path: '/chat',
      body: { participants: ['6500buyer', '6500seller'], title: 'Escrow #NEO-2023-001' },
      description: describe(
        'Creates a conversation between participants. Typically invoked when buyer/seller start negotiation.',
        fmt({ participants: ['6500buyer', '6500seller'], title: 'Escrow #NEO-2023-001' }),
        fmt({ conversation: { _id: '650a...', participants: ['6500buyer', '6500seller'], title: 'Escrow #NEO-2023-001' } })
      ),
    },
    {
      name: 'List Conversations',
      method: 'GET',
      path: '/chat',
      description: describe(
        'Lists all conversations containing the current user sorted by `updatedAt` DESC.',
        null,
        fmt({
          conversations: [
            { _id: '650a...', participants: ['6500buyer', '6500seller'], title: 'Escrow #NEO-2023-001', updatedAt: '2023-09-26T10:00:00Z' },
          ],
        })
      ),
    },
    {
      name: 'Get Messages',
      method: 'GET',
      path: '/chat/650aabcdef1234567890abcd/messages',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '50' },
      ],
      description: describe(
        'Paginated messages with optional `before`/`after` cursors. Responses include `hasMore` and `total`.',
        null,
        fmt({
          messages: [
            { _id: 'msg01', sender: '6500buyer', body: 'Hi! Is the item still available?', attachments: [], createdAt: '2023-09-26T10:01:00Z' },
          ],
          page: 1,
          limit: 50,
          total: 3,
          hasMore: false,
        })
      ),
    },
    {
      name: 'Post Message',
      method: 'POST',
      path: '/chat/650aabcdef1234567890abcd/messages',
      body: { body: 'Payment released.', attachments: [{ url: 'https://cdn.example.com/receipt.pdf', filename: 'receipt.pdf' }] },
      description: describe(
        'Persists the message, emits over Socket.IO (room = conversation id), and notifies other participants.',
        fmt({ body: 'Payment released.', attachments: [{ url: 'https://cdn.example.com/receipt.pdf', filename: 'receipt.pdf' }] }),
        fmt({ message: { _id: 'msg04', conversationId: '650aabcdef1234567890abcd', sender: '6500buyer', body: 'Payment released.', attachments: [{ url: 'https://cdn.example.com/receipt.pdf', filename: 'receipt.pdf' }] } })
      ),
    },
    {
      name: 'Mark Conversation Read',
      method: 'PUT',
      path: '/chat/650aabcdef1234567890abcd/read',
      body: null,
      description: describe(
        'Marks every message in the conversation as read by the current user.',
        null,
        fmt({ ok: true })
      ),
    },
    {
      name: 'Mark Message Read',
      method: 'PUT',
      path: '/chat/650aabcdef1234567890abcd/messages/msg04/read',
      body: null,
      description: describe(
        'Marks a specific message as read (adds user id to `readBy`).',
        null,
        fmt({ ok: true })
      ),
    },
  ])
);

sections.push(
  makeSection('Wallet', 'Stored-value ledger with Tap/MyFatoorah integrations.', [
    {
      name: 'Create Top-Up Session',
      method: 'POST',
      path: '/wallet/topup',
      body: { amount: 100, idempotencyKey: 'wallet-topup-001', redirectUrl: 'https://app.neosoq.com/payments/return' },
      description: describe(
        'Creates a payment session (Tap/MyFatoorah) and returns a checkout URL + provider session id. Uses idempotency middleware to prevent duplicate submissions.',
        fmt({ amount: 100, idempotencyKey: 'wallet-topup-001', redirectUrl: 'https://app.neosoq.com/payments/return' }),
        fmt({ checkoutUrl: 'https://checkout.myfatoorah.com/123', sessionId: 'session_abc123', raw: { id: 'txn_simulated', status: 'pending' } }),
        ['Requires `MYFATOORAH_API_KEY` and `MYFATOORAH_BASE_URL` in the environment.']
      ),
    },
    {
      name: 'Withdraw Funds',
      method: 'POST',
      path: '/wallet/withdraw',
      body: { amount: 50, idempotencyKey: 'withdraw-001' },
      description: describe(
        'Debits the user wallet (requires `kycVerified`). Funds move into the admin wallet for manual payout.',
        fmt({ amount: 50, idempotencyKey: 'withdraw-001' }),
        fmt({ ok: true, balanceAfter: 150 }),
        ['Fails with 403 if `kycVerified` flag is false.']
      ),
    },
    {
      name: 'Get Wallet Overview',
      method: 'GET',
      path: '/wallet',
      description: describe(
        'Returns wallet balances and latest 10 ledger entries.',
        null,
        fmt({
          wallet: { _id: 'wallet1', available: 200, locked: 50, currency: 'KWD', timeAgo: '1m' },
          ledger: [
            { _id: 'led1', amount: 100, type: 'credit', category: 'topup', balanceAfter: 200 },
            { _id: 'led2', amount: 50, type: 'debit', category: 'withdraw', balanceAfter: 150 },
          ],
        })
      ),
    },
    {
      name: 'Payment Webhook (MyFatoorah)',
      method: 'POST',
      path: '/wallet/webhooks/myfatoorah',
      auth: 'none',
      bodyType: 'text',
      textContentType: 'application/json',
      body: JSON.stringify({
        data: {
          object: { status: 'paid', amount: 100, metadata: { userId: '6500buyer', idempotencyKey: 'wallet-topup-001' }, id: 'txn_123' },
        },
      }),
      description: describe(
        'Endpoint called by payment provider. Validates signature (when configured), credits wallet, and writes ledger entries.',
        JSON.stringify({
          data: {
            object: { status: 'paid', amount: 100, metadata: { userId: '6500buyer', idempotencyKey: 'wallet-topup-001' }, id: 'txn_123' },
          },
        }),
        fmt({ ok: true }),
        ['Set `MYFATOORAH_SECRET_KEY` so signature verification succeeds outside of tests.']
      ),
    },
  ])
);

sections.push(
  makeSection('Escrow', 'Buyer funds locking, releases, and admin overrides.', [
    {
      name: 'Create Escrow',
      method: 'POST',
      path: '/escrow',
      body: { workerId: '6500worker', listingId: '6501abcdef1234567890abcd', amount: 320, idempotencyKey: 'escrow-001' },
      description: describe(
        'Debits buyer wallet (moves funds from available to locked) and creates an escrow record referencing listing/request/offer.',
        fmt({ workerId: '6500worker', listingId: '6501abcdef1234567890abcd', amount: 320, idempotencyKey: 'escrow-001' }),
        fmt({ escrow: { _id: '650b...', buyerId: '6500buyer', workerId: '6500worker', amount: 320, status: 'active', confirmations: { buyer: false, worker: false } } })
      ),
    },
    {
      name: 'Confirm Escrow (Buyer/Worker)',
      method: 'PUT',
      path: '/escrow/650babcdef1234567890abcd/confirm',
      body: null,
      description: describe(
        'Marks `confirmations.buyer` or `confirmations.worker` true based on current user id.',
        null,
        fmt({ escrow: { _id: '650babcdef1234567890abcd', confirmations: { buyer: true, worker: false } } })
      ),
    },
    {
      name: 'Release Escrow (Mutual)',
      method: 'POST',
      path: '/escrow/650babcdef1234567890abcd/release',
      body: null,
      description: describe(
        'Requires both confirmations. Moves funds from buyer locked balance to worker available balance and closes escrow.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'completed' } })
      ),
    },
    {
      name: 'Cancel Escrow (Refund Buyer)',
      method: 'PUT',
      path: '/escrow/650babcdef1234567890abcd/cancel',
      body: null,
      description: describe(
        'Refunds locked funds back to buyer available balance and marks escrow as `cancelled`.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'cancelled' } })
      ),
    },
    {
      name: 'Get Escrow Detail',
      method: 'GET',
      path: '/escrow/650babcdef1234567890abcd',
      description: describe(
        'Returns escrow payload plus ledger entries referencing the escrow id.',
        null,
        fmt({
          escrow: { _id: '650babcdef1234567890abcd', buyerId: '6500buyer', workerId: '6500worker', status: 'active', timeAgo: '3m' },
          ledgers: [
            { _id: 'led10', walletId: 'wallet_buyer', type: 'debit', category: 'escrow_hold', amount: 320 },
          ],
        })
      ),
    },
    {
      name: 'Ledger Audit (Admin)',
      method: 'GET',
      path: '/escrow/admin/ledger-audit',
      auth: 'admin',
      description: describe(
        'Scans all wallets and compares ledger aggregates to detect mismatches.',
        null,
        fmt({ mismatches: [], count: 0 })
      ),
    },
    {
      name: 'Admin Force Release',
      method: 'POST',
      path: '/escrow/650babcdef1234567890abcd/force-release',
      auth: 'admin',
      body: null,
      description: describe(
        'Forcefully releases funds to the worker regardless of confirmations. Protected by `idempotency` middleware.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'completed', adminAction: { action: 'force_release' } } })
      ),
    },
    {
      name: 'Admin Force Refund',
      method: 'POST',
      path: '/escrow/650babcdef1234567890abcd/force-refund',
      auth: 'admin',
      body: null,
      description: describe(
        'Forcefully refunds locked funds back to the buyer.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'cancelled', adminAction: { action: 'force_refund' } } })
      ),
    },
  ])
);

sections.push(
  makeSection('Promotions', 'Sponsored listing plans and webhooks.', [
    {
      name: 'List Promotion Plans',
      method: 'GET',
      path: '/promotions',
      auth: 'none',
      description: describe(
        'Public plans ordered by price.',
        null,
        fmt({
          plans: [
            { _id: 'plan_basic', title: 'Spotlight 7 days', description: 'Featured for one week', price: 25, durationDays: 7 },
          ],
        })
      ),
    },
    {
      name: 'Get Promotion Plan',
      method: 'GET',
      path: '/promotions/plan_basic',
      auth: 'none',
      description: describe(
        'Returns a single plan (also used to drive purchase confirmation).',
        null,
        fmt({ plan: { _id: 'plan_basic', title: 'Spotlight 7 days', price: 25, durationDays: 7, active: true } })
      ),
    },
    {
      name: 'Purchase Plan',
      method: 'POST',
      path: '/promotions/purchase',
      body: { planId: 'plan_basic', paymentMethod: 'wallet', idempotencyKey: 'promo-001' },
      description: describe(
        'Purchases a plan using wallet or MyFatoorah. Wallet flow debits instantly; card flow returns a checkout URL similar to the wallet top-up response.',
        fmt({ planId: 'plan_basic', paymentMethod: 'wallet', idempotencyKey: 'promo-001' }),
        fmt({ purchase: { _id: 'purchase1', plan: 'plan_basic', status: 'active', startDate: '2023-09-26T10:00:00Z', endDate: '2023-10-03T10:00:00Z' } })
      ),
    },
    {
      name: 'Promotions Webhook (MyFatoorah)',
      method: 'POST',
      path: '/promotions/webhooks/myfatoorah',
      auth: 'none',
      bodyType: 'text',
      textContentType: 'application/json',
      body: JSON.stringify({
        data: {
          object: {
            status: 'paid',
            amount: 25,
            metadata: { purchaseId: 'purchase1', userId: '6500seller' },
            id: 'promo_txn_123',
          },
        },
      }),
      description: describe(
        'Payment provider callback for promotions. Marks purchase as `completed`, stores transaction details, and notifies the user.',
        JSON.stringify({
          data: {
            object: {
              status: 'paid',
              amount: 25,
              metadata: { purchaseId: 'purchase1', userId: '6500seller' },
              id: 'promo_txn_123',
            },
          },
        }),
        fmt({ ok: true })
      ),
    },
  ])
);

sections.push(
  makeSection('User Content Aggregations', 'Public endpoints for profile pages.', [
    {
      name: 'User Listings',
      method: 'GET',
      path: '/users/6500seller/listings',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'search', value: 'iphone' },
      ],
      description: describe(
        'Returns the user profile snapshot and their listings, optionally filtered by `search`.',
        null,
        fmt({
          user: { id: '6500seller', username: 'Hassan', rating: 4.8 },
          listings: [
            { _id: '6501...', title: { en: 'iPhone 14 Pro 256GB', ar: '' }, status: 'open', timeAgo: '2h' },
          ],
          page: 1,
          limit: 20,
          totalCount: 4,
        })
      ),
    },
    {
      name: 'User Offers',
      method: 'GET',
      path: '/users/6500seller/offers',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Offers submitted by the user with normalized `quantity` and localized proposal text.',
        null,
        fmt({
          user: { id: '6500seller', username: 'Hassan' },
          offers: [
            { _id: '6503...', listingId: '6501...', price: 290, status: 'pending', timeAgo: '3d' },
          ],
          page: 1,
          limit: 20,
          totalCount: 2,
        })
      ),
    },
    {
      name: 'User Posts',
      method: 'GET',
      path: '/users/6500seller/posts',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'User-authored posts (localized) plus profile snapshot.',
        null,
        fmt({
          user: { id: '6500seller', username: 'Hassan' },
          posts: [
            { _id: '6505...', message: { en: 'Packing orders!', ar: '' }, timeAgo: '1d' },
          ],
          page: 1,
          limit: 20,
          totalCount: 6,
        })
      ),
    },
    {
      name: 'User Requests',
      method: 'GET',
      path: '/users/6500seller/requests',
      auth: 'none',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Requests created by the user with localized fields.',
        null,
        fmt({
          user: { id: '6500seller', username: 'Hassan' },
          requests: [
            { _id: '6502...', title: { en: 'Need packaging design', ar: '' }, status: 'open', timeAgo: '5d' },
          ],
          page: 1,
          limit: 20,
          totalCount: 1,
        })
      ),
    },
  ])
);

const adminSections = [];

adminSections.push(
  makeSection('Admin Auth & Invites', 'Secure staff access + invite issuance.', [
    {
      name: 'Admin Sign-In',
      method: 'POST',
      path: '/admin/auth/signin',
      auth: 'none',
      body: { email: 'support@neosoq.com', password: 'AdminPass!23' },
      description: describe(
        'Authenticates admin/support/moderator accounts (roles must include one of allowed roles). Returns tokens identical to user login but requires admin-level roles.',
        fmt({ email: 'support@neosoq.com', password: 'AdminPass!23' }),
        fmt({
          accessToken: '<admin-access>',
          refreshToken: '<admin-refresh>',
          user: { id: '64admin', username: 'Support Lead', email: 'support@neosoq.com', roles: ['admin'], adminAccess: ['dashboard'] },
        })
      ),
    },
    {
      name: 'Create Staff Invite',
      method: 'POST',
      path: '/admin/staff/invite',
      auth: 'admin',
      body: { email: 'newmod@neosoq.com', roles: ['moderator'], adminAccess: ['requests', 'listings'] },
      description: describe(
        'Generates an invite token emailed to the candidate. Requires admin bearer token.',
        fmt({ email: 'newmod@neosoq.com', roles: ['moderator'], adminAccess: ['requests', 'listings'] }),
        fmt({ message: 'Invite created and email sent (if configured)' })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Users', 'User insights and moderation actions.', [
    {
      name: 'User Summary Cards',
      method: 'GET',
      path: '/admin/users/summary',
      auth: 'admin',
      description: describe(
        'Counts total users, banned users, and returns recent signups plus top payers.',
        null,
        fmt({
          totalUsers: 1024,
          bannedUsers: 7,
          recentUsers: [{ username: 'Hanan', email: 'hanan@example.com', createdAt: '2023-09-25T12:00:00Z', active: true }],
          topPayers: [{ _id: '6500seller', total: 1200 }],
        })
      ),
    },
    {
      name: 'List Users',
      method: 'GET',
      path: '/admin/users',
      auth: 'admin',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'role', value: 'seller' },
        { key: 'active', value: 'true' },
        { key: 'search', value: 'hanan' },
      ],
      description: describe(
        'Supports `email`, `username`, `role`, `active`, `fields`, `sortBy`, `sortDir`, `skip`, `limit`. Returns paginated docs.',
        null,
        fmt({
          docs: [
            { _id: '6500seller', username: 'Hanan', email: 'hanan@example.com', active: true },
          ],
          total: 3,
          page: 1,
          pages: 1,
          limit: 20,
        })
      ),
    },
    {
      name: 'Ban / Unban User',
      method: 'POST',
      path: '/admin/users/6500seller/ban',
      auth: 'admin',
      body: { ban: true },
      description: describe(
        'Toggles the `active` flag (ban=true sets active=false). Also fires a best-effort email notification.',
        fmt({ ban: true }),
        fmt({ message: 'OK', user: { _id: '6500seller', username: 'Hanan', active: false } })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Listings', 'Content review workflow for listings.', [
    {
      name: 'List Listings (Admin View)',
      method: 'GET',
      path: '/admin/listings',
      auth: 'admin',
      query: [
        { key: 'status', value: 'open' },
        { key: 'category', value: 'Electronics' },
        { key: 'search', value: 'iphone' },
        { key: 'limit', value: '20' },
        { key: 'skip', value: '0' },
      ],
      description: describe(
        'Aggregates seller info, counts offers, and supports additional filters (`sellerType`, `method`).',
        null,
        fmt({
          docs: [
            { _id: '6501...', title: { en: 'iPhone 14 Pro 256GB' }, sellerName: 'Ayesha', offersCount: 3, sellerPhone: '+96511112222' },
          ],
          total: 5,
          page: 1,
          pages: 1,
          limit: 20,
        })
      ),
    },
    {
      name: 'Get Listing Details (Admin)',
      method: 'GET',
      path: '/admin/listings/6501abcdef1234567890abcd',
      auth: 'admin',
      description: describe(
        'Returns listing plus enriched offers (bidder name, phone, profile image).',
        null,
        fmt({
          listing: { _id: '6501abcdef1234567890abcd', title: { en: 'iPhone 14 Pro 256GB', ar: '' } },
          offers: [
            { id: '6503...', bidderName: 'Hassan', phoneNumber: '+96522223333', amount: 290, status: 'pending' },
          ],
        })
      ),
    },
    {
      name: 'Approve Listing',
      method: 'POST',
      path: '/admin/listings/6501abcdef1234567890abcd/approve',
      auth: 'admin',
      body: { note: 'Looks good' },
      description: describe(
        'Marks listing review as completed, optionally storing a note, and notifies the owner by email + in-app notification.',
        fmt({ note: 'Looks good' }),
        fmt({ message: 'approved', listing: { _id: '6501abcdef1234567890abcd', reviewCompleted: true } })
      ),
    },
    {
      name: 'Reject Listing',
      method: 'POST',
      path: '/admin/listings/6501abcdef1234567890abcd/reject',
      auth: 'admin',
      body: { reason: 'Images contain contact info' },
      description: describe(
        'Closes the listing and notifies the owner with the rejection reason.',
        fmt({ reason: 'Images contain contact info' }),
        fmt({ message: 'rejected', listing: { _id: '6501abcdef1234567890abcd', status: 'closed', reviewNote: 'Images contain contact info' } })
      ),
    },
    {
      name: 'Delete Listing (Admin)',
      method: 'DELETE',
      path: '/admin/listings/6501abcdef1234567890abcd',
      auth: 'admin',
      description: describe(
        'Removes the listing and notifies the owner.',
        null,
        fmt({ message: 'deleted' })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Requests', 'Moderation tooling for service requests.', [
    {
      name: 'List Requests (Admin)',
      method: 'GET',
      path: '/admin/requests',
      auth: 'admin',
      query: [
        { key: 'status', value: 'open' },
        { key: 'limit', value: '20' },
        { key: 'skip', value: '0' },
      ],
      description: describe(
        'Joins creator info and counts total applications (offers).',
        null,
        fmt({
          docs: [
            { _id: '6502...', title: { en: 'Need a bilingual landing page' }, creatorName: 'Omar', totalApplications: 4 },
          ],
          total: 2,
          page: 1,
          pages: 1,
          limit: 20,
        })
      ),
    },
    {
      name: 'Get Request Details (Admin)',
      method: 'GET',
      path: '/admin/requests/6502abcdef1234567890cdef',
      auth: 'admin',
      description: describe(
        'Includes applicant list with bidder profile snapshots.',
        null,
        fmt({
          request: { _id: '6502abcdef1234567890cdef', title: { en: 'Need a bilingual landing page', ar: '' } },
          applicants: [
            { id: '6503...', name: 'Hassan', bidAmount: 700, applicationDate: '2023-09-24T10:00:00Z', status: 'pending', coverLetter: { en: 'Can deliver in 1 week' } },
          ],
        })
      ),
    },
    {
      name: 'Approve Request',
      method: 'POST',
      path: '/admin/requests/6502abcdef1234567890cdef/approve',
      auth: 'admin',
      description: describe(
        'Marks the request as awarded and emails/notifies the owner.',
        null,
        fmt({ message: 'approved', request: { _id: '6502abcdef1234567890cdef', status: 'awarded' } })
      ),
    },
    {
      name: 'Reject Request',
      method: 'POST',
      path: '/admin/requests/6502abcdef1234567890cdef/reject',
      auth: 'admin',
      body: { reason: 'Missing budget details' },
      description: describe(
        'Closes the request and notifies the owner with the provided reason.',
        fmt({ reason: 'Missing budget details' }),
        fmt({ message: 'rejected', request: { _id: '6502abcdef1234567890cdef', status: 'closed' } })
      ),
    },
    {
      name: 'Delete Request (Admin)',
      method: 'DELETE',
      path: '/admin/requests/6502abcdef1234567890cdef',
      auth: 'admin',
      description: describe(
        'Deletes the request and notifies the owner.',
        null,
        fmt({ message: 'deleted' })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Promotions', 'Plan management and purchase visibility.', [
    {
      name: 'Create Promotion Plan',
      method: 'POST',
      path: '/admin/promotions',
      auth: 'admin',
      body: { title: 'Homepage Hero 14d', description: 'Hero banner slot for 14 days', price: 80, durationDays: 14, adminFeePercent: 15, active: true },
      description: describe(
        'Creates a new promotion plan for marketplace sellers.',
        fmt({ title: 'Homepage Hero 14d', description: 'Hero banner slot for 14 days', price: 80, durationDays: 14, adminFeePercent: 15, active: true }),
        fmt({ plan: { _id: 'plan_hero14', title: 'Homepage Hero 14d', price: 80, adminFeePercent: 15, active: true } })
      ),
    },
    {
      name: 'List Promotion Plans (Admin)',
      method: 'GET',
      path: '/admin/promotions',
      auth: 'admin',
      description: describe(
        'Returns all plans regardless of `active` flag.',
        null,
        fmt({
          plans: [
            { _id: 'plan_basic', title: 'Spotlight 7 days', price: 25 },
            { _id: 'plan_hero14', title: 'Homepage Hero 14d', price: 80 },
          ],
        })
      ),
    },
    {
      name: 'Update Promotion Plan',
      method: 'PUT',
      path: '/admin/promotions/plan_basic',
      auth: 'admin',
      body: { price: 30, active: false },
      description: describe(
        'Modify plan attributes (price, duration, active, adminFeePercent).',
        fmt({ price: 30, active: false }),
        fmt({ plan: { _id: 'plan_basic', price: 30, active: false } })
      ),
    },
    {
      name: 'List Promotion Purchases',
      method: 'GET',
      path: '/admin/promotions/purchases',
      auth: 'admin',
      description: describe(
        'Lists recent purchases with populated plan & user references.',
        null,
        fmt({
          purchases: [
            { _id: 'purchase1', user: { username: 'Hassan' }, plan: { title: 'Spotlight 7 days' }, status: 'active', amount: 25 },
          ],
        })
      ),
    },
    {
      name: 'Get Promotion Purchase',
      method: 'GET',
      path: '/admin/promotions/purchases/purchase1',
      auth: 'admin',
      description: describe(
        'Detailed view including plan + user documents.',
        null,
        fmt({ purchase: { _id: 'purchase1', user: { username: 'Hassan' }, plan: { title: 'Spotlight 7 days' }, status: 'active' } })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Transactions & Payments', 'Ledger, payouts, analytics for finance.', [
    {
      name: 'List Transactions',
      method: 'GET',
      path: '/admin/transactions',
      auth: 'admin',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'status', value: 'completed' },
        { key: 'type', value: 'promotion' },
      ],
      description: describe(
        'Paginated list of transactions with optional filters on `status`, `type`, `paymentMethod`, `userId`.',
        null,
        fmt({
          data: [
            { _id: 'txn_001', userId: '6500seller', type: 'promotion', amount: 25, status: 'completed' },
          ],
          meta: { total: 42, page: 1, limit: 20 },
        })
      ),
    },
    {
      name: 'Transaction Summary Cards',
      method: 'GET',
      path: '/admin/transactions/summary',
      auth: 'admin',
      description: describe(
        'Aggregates totals (total transactions, revenue from credit-type transactions, failed counts, pending amount).',
        null,
        fmt({ totalTransactions: 452, totalRevenue: 18050, failedTransactions: 3, pendingAmount: 120 })
      ),
    },
    {
      name: 'Transaction Detail',
      method: 'GET',
      path: '/admin/transactions/txn_001',
      auth: 'admin',
      description: describe(
        'Returns transaction plus user info for receipts/support.',
        null,
        fmt({ _id: 'txn_001', userId: '6500seller', type: 'promotion', amount: 25, status: 'completed', user: { email: 'seller@example.com' } })
      ),
    },
    {
      name: 'Wallet Transactions (Payment Ops)',
      method: 'GET',
      path: '/admin/payments/wallet-transactions',
      auth: 'admin',
      query: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
        { key: 'type', value: 'wallet_topup' },
      ],
      description: describe(
        'Detailed wallet ledger (Transaction collection) with optional search on user name/phone.',
        null,
        fmt({
          data: [
            { _id: 'txn_wallet_1', user: { username: 'Omar' }, amount: 100, type: 'wallet_topup', status: 'completed' },
          ],
          meta: { total: 20, page: 1, limit: 20 },
        })
      ),
    },
    {
      name: 'Withdrawal Requests',
      method: 'GET',
      path: '/admin/payments/withdrawal-requests',
      auth: 'admin',
      query: [
        { key: 'status', value: 'pending' },
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Lists withdrawal entries awaiting manual payout.',
        null,
        fmt({
          data: [
            { _id: 'wd_001', user: { username: 'Hanan' }, amount: 75, method: 'bank_transfer', status: 'pending' },
          ],
          meta: { total: 2, page: 1, limit: 20 },
        })
      ),
    },
    {
      name: 'Payment Summary Dashboard',
      method: 'GET',
      path: '/admin/payments/summary',
      auth: 'admin',
      description: describe(
        'Provides totals for credits, pending credits, combined wallet balances, pending withdrawal count/amount, and active disputes.',
        null,
        fmt({
          totalWalletCredits: 31000,
          pendingCredits: 500,
          combinedWalletAvailable: 18000,
          combinedWalletLocked: 3200,
          pendingWithdrawalCount: 4,
          pendingWithdrawalTotal: 600,
          activeDisputes: 2,
        })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Escrow', 'Monitoring + overrides for escrow accounts.', [
    {
      name: 'List Escrows (Admin)',
      method: 'GET',
      path: '/admin/escrow',
      auth: 'admin',
      query: [
        { key: 'status', value: 'active' },
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Lists escrow records with payer/recipient user info for quick triage.',
        null,
        fmt({
          data: [
            { _id: '650b...', amount: 320, status: 'active', payer: { username: 'Omar' }, recipient: { username: 'Hassan' } },
          ],
          meta: { total: 3, page: 1, limit: 20 },
        })
      ),
    },
    {
      name: 'Escrow Detail (Admin)',
      method: 'GET',
      path: '/admin/escrow/650babcdef1234567890abcd',
      auth: 'admin',
      description: describe(
        'Returns escrow, payer/recipient info, and ledger history.',
        null,
        fmt({
          escrow: { _id: '650babcdef1234567890abcd', amount: 320, status: 'active', payer: { username: 'Omar' }, recipient: { username: 'Hassan' } },
          ledgers: [
            { _id: 'led10', walletId: 'wallet_buyer', type: 'debit', category: 'escrow_hold', amount: 320 },
          ],
        })
      ),
    },
    {
      name: 'Force Release (Admin Shortcut)',
      method: 'POST',
      path: '/escrow/650babcdef1234567890abcd/force-release',
      auth: 'admin',
      description: describe(
        'Same as the Escrow section entry, repeated here for quick access.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'completed', adminAction: { action: 'force_release' } } })
      ),
    },
    {
      name: 'Force Refund (Admin Shortcut)',
      method: 'POST',
      path: '/escrow/650babcdef1234567890abcd/force-refund',
      auth: 'admin',
      description: describe(
        'Same as the Escrow section entry, repeated here for quick access.',
        null,
        fmt({ ok: true, escrow: { _id: '650babcdef1234567890abcd', status: 'cancelled', adminAction: { action: 'force_refund' } } })
      ),
    },
  ])
);

adminSections.push(
  makeSection('Admin Analytics & Dashboard', 'High-level signals for leadership dashboards.', [
    {
      name: 'Revenue Trend',
      method: 'GET',
      path: '/admin/analytics/revenue-trend',
      auth: 'admin',
      query: [
        { key: 'range', value: '30d' },
      ],
      description: describe(
        'Groups completed transactions by day (≤90d) or month (>90d) within the requested range/preset.',
        null,
        fmt({
          data: [
            { period: '2023-09-24', revenue: 540 },
            { period: '2023-09-25', revenue: 320 },
          ],
        })
      ),
    },
    {
      name: 'Monthly Transactions',
      method: 'GET',
      path: '/admin/analytics/monthly-transactions',
      auth: 'admin',
      query: [
        { key: 'months', value: '6' },
      ],
      description: describe(
        'Counts transactions per month for the specified trailing window.',
        null,
        fmt({
          data: [
            { month: '2023-04', count: 120 },
            { month: '2023-05', count: 140 },
          ],
        })
      ),
    },
    {
      name: 'Top Performers',
      method: 'GET',
      path: '/admin/analytics/top-performers',
      auth: 'admin',
      query: [
        { key: 'limit', value: '5' },
        { key: 'range', value: '90d' },
      ],
      description: describe(
        'Ranks users by revenue contribution (transactions of types: listing_purchase, request_payment, escrow_payment, credit). Optional `search` filters by user name/position.',
        null,
        fmt({
          data: [
            { userId: '6500seller', name: 'Hassan', revenue: 2400, img: null, position: 'Seller', rating: 4.9 },
          ],
        })
      ),
    },
    {
      name: 'Dashboard Cards',
      method: 'GET',
      path: '/admin/analytics/dashboard-cards',
      auth: 'admin',
      description: describe(
        'Monthly revenue vs previous month, new users delta, lifetime transaction count, and average daily chat messages.',
        null,
        fmt({
          monthlyRevenue: 4200,
          monthlyRevenuePct: 12.5,
          newUsersThisMonth: 210,
          newUsersPct: 8.2,
          lifetimeTransactions: 1820,
          avgDailyMessages: 65,
        })
      ),
    },
    {
      name: 'Category Distribution',
      method: 'GET',
      path: '/admin/analytics/category-distribution',
      auth: 'admin',
      query: [
        { key: 'range', value: '30d' },
      ],
      description: describe(
        'Distribution of listings by category for a date range or preset (7d/30d/3mo/6mo/1y). Adds an “Other” bucket for uncategorized segments.',
        null,
        fmt({
          total: 480,
          data: [
            { category: 'Automotive', count: 120, percent: 25 },
            { category: 'Electronics', count: 200, percent: 41.67 },
            { category: 'Services', count: 90, percent: 18.75 },
            { category: 'Furniture', count: 40, percent: 8.33 },
            { category: 'Other', count: 30, percent: 6.25 },
          ],
        })
      ),
    },
    {
      name: 'Dashboard Summary (Legacy)',
      method: 'GET',
      path: '/admin/dashboard/summary',
      auth: 'admin',
      description: describe(
        'Legacy summary used by early admin UI: user/listing/request counts, cumulative revenue, completed transaction count, and most recent transactions.',
        null,
        fmt({
          usersCount: 1200,
          listingsCount: 340,
          requestsCount: 115,
          revenue: 30200,
          transactionsCount: 820,
          recentTransactions: [{ _id: 'txn_001', userId: '6500seller', amount: 25, status: 'completed' }],
        })
      ),
    },
    {
      name: 'Dashboard Transactions (Legacy)',
      method: 'GET',
      path: '/admin/dashboard/transactions',
      auth: 'admin',
      query: [
        { key: 'status', value: 'completed' },
        { key: 'page', value: '1' },
        { key: 'limit', value: '20' },
      ],
      description: describe(
        'Legacy transaction list powering dashboard widgets (still useful for quick debugging).',
        null,
        fmt({
          docs: [
            { _id: 'txn_legacy1', amount: 25, status: 'completed', createdAt: '2023-09-25T10:00:00Z' },
          ],
          total: 200,
          page: 1,
          pages: 10,
          limit: 20,
        })
      ),
    },
  ])
);

sections.push({
  name: 'Admin',
  description: 'All admin-facing endpoints grouped by capability.',
  item: adminSections,
});

const collection = {
  info: {
    name: 'Neosoq API — Full Surface (2025-11)',
    _postman_id: 'neosoq-api-detailed',
    description: 'Comprehensive Postman collection covering customer, marketplace, wallet/escrow, and admin APIs with sample payloads and notes.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3500' },
    { key: 'authToken', value: '' },
    { key: 'adminToken', value: '' },
  ],
  item: sections,
};

const outFile = path.join(__dirname, '..', 'postman', 'neosoq-detailed.postman_collection.json');
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));
console.log(`Wrote ${outFile}`);

