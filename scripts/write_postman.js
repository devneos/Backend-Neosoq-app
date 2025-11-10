const fs = require('fs');
const out = {
  info: { _postman_id: 'neosoq-marketplace-v2', name: 'Neosoq Marketplace API (updated)', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  variable: [ { key: 'baseUrl', value: 'http://localhost:3500' }, { key: 'accessToken', value: '' } ],
  event: [ { listen: 'prerequest', script: { type: 'text/javascript', exec: ["const t = pm.environment.get('accessToken'); if (t) pm.environment.set('Authorization', 'Bearer ' + t);"] } } ],
  item: [
    {
      name: 'Auth',
      item: [
        {
          name: 'Send Phone (POST /auth/send)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ phone: '+1234567890' }) },
            url: { raw: '{{baseUrl}}/auth/send', host: ['{{baseUrl}}'], path: ['auth','send'] },
            description: 'Send OTP to phone. Example: returns 200 with message and success flag.'
          },
          response: [ { name: '200', status: 'OK', code: 200, body: JSON.stringify({ message: 'Verification code sent successfully', success: true }) } ]
        },
        {
          name: 'Verify Login Code (POST /auth/login/verify)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ phoneNumber: '+1234567890', verificationCode: '123456' }) },
            url: { raw: '{{baseUrl}}/auth/login/verify', host: ['{{baseUrl}}'], path: ['auth','login','verify'] },
            description: 'Verify OTP and login: returns accessToken, refreshToken (also set as cookie) and user object.'
          },
          response: [ { name: '200', status: 'OK', code: 200, body: JSON.stringify({ accessToken: '<jwt>', refreshToken: '<jwt>', user: { id: '<id>', username: 'user1' } }) } ]
        }
      ]
    },
    {
      name: 'Listings',
      item: [
        {
          name: 'Create Listing (POST /listings)',
          request: {
            method: 'POST',
            header: [ { key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' } ],
            body: { mode: 'raw', raw: JSON.stringify({ category: 'bicycles', subCategory: 'mountain', title: 'Blue Bicycle', description: 'A well kept blue bicycle', price: 120, files: [] }) },
            url: { raw: '{{baseUrl}}/listings', host: ['{{baseUrl}}'], path: ['listings'] },
            description: 'Create a listing. title/description may be string or localized object; server normalizes to {en,ar}. Attach file metadata (from uploads endpoint) in `files`.'
          },
          response: [ { name: '201 - Created', status: 'Created', code: 201, body: JSON.stringify({ listing: { _id: '<id>', category: 'bicycles', title: { en: 'Blue Bicycle', ar: '' }, description: { en: 'A well kept blue bicycle', ar: '' }, files: [], images: [], createdBy: '<userId>' } }) } ]
        },
        {
          name: 'Get Listing (GET /listings/:id)',
          request: { method: 'GET', url: { raw: '{{baseUrl}}/listings/:id', host: ['{{baseUrl}}'], path: ['listings',':id'] }, description: 'Returns full listing object; localized fields returned as objects {en,ar}.' },
          response: [ { name: '200 - OK', status: 'OK', code: 200, body: JSON.stringify({ listing: { _id: '<id>', title: { en: 'Blue Bicycle', ar: '' }, description: { en: 'A well kept blue bicycle', ar: '' }, files: [ { filename: 'specs.pdf', originalname: 'specs.pdf', mimeType: 'application/pdf', size: 102400, urlSrc: 'https://.../specs.pdf', publicId: 'p1', description: { en: 'Specs doc', ar: '' } } ], images: ['https://.../photo1.jpg'], createdBy: { id: '<userId>', username: 'seller1' } } }) } ]
        },
        { name: 'List Listings (GET /listings)', request: { method: 'GET', url: { raw: '{{baseUrl}}/listings?page=1&limit=20', host: ['{{baseUrl}}'], path: ['listings'] }, description: 'Search and list listings; returns localized fields.' } },
        { name: 'Update Listing (PUT /listings/:id)', request: { method: 'PUT', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' }], body: { mode: 'raw', raw: JSON.stringify({ title: 'Updated title', removedFiles: [] }) }, url: { raw: '{{baseUrl}}/listings/:id', host: ['{{baseUrl}}'], path: ['listings',':id'] }, description: 'Update listing. Use `removedFiles` array to remove attachments; to add new files, upload via /uploads/attach and include returned metadata in `files`.' } },
        { name: 'Delete Listing (DELETE /listings/:id)', request: { method: 'DELETE', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }], url: { raw: '{{baseUrl}}/listings/:id', host: ['{{baseUrl}}'], path: ['listings',':id'] }, description: 'Delete listing (owner only).' } }
      ]
    },
    {
      name: 'Offers',
      item: [
        {
          name: 'Create Offer (POST /offers)',
          request: {
            method: 'POST',
            header: [ { key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' } ],
            body: { mode: 'raw', raw: JSON.stringify({ listingId: '<listingId>', price: 95, proposalText: 'I can do this for you', files: [] }) },
            url: { raw: '{{baseUrl}}/offers', host: ['{{baseUrl}}'], path: ['offers'] },
            description: 'Create an offer. Requires price and listingId/requestId; proposalText will be normalized to localized object.'
          },
          response: [ { name: '201 - Created', status: 'Created', code: 201, body: JSON.stringify({ offer: { _id: '<offerId>', listingId: '<listingId>', userId: '<userId>', price: 95, proposalText: { en: 'I can do this for you', ar: '' }, files: [] } }) } ]
        },
        { name: 'Accept Offer (PUT /offers/:id/accept)', request: { method: 'PUT', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }], url: { raw: '{{baseUrl}}/offers/:id/accept', host: ['{{baseUrl}}'], path: ['offers',':id','accept'] }, description: 'Owner accepts offer; server will set status and awardedOffer on owner.' } }
      ]
    },
    {
      name: 'Requests',
      item: [
        {
          name: 'Create Request (POST /requests)',
          request: { method: 'POST', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' }], body: { mode: 'raw', raw: JSON.stringify({ title: 'Need a website', description: 'Simple 5 page site', projectType: 'one-time', pricingType: 'fixed', price: 500, files: [] }) }, url: { raw: '{{baseUrl}}/requests', host: ['{{baseUrl}}'], path: ['requests'] }, description: 'Create a service request. title/description normalized to localized object.' },
        { name: 'Get Request (GET /requests/:id)', request: { method: 'GET', url: { raw: '{{baseUrl}}/requests/:id', host: ['{{baseUrl}}'], path: ['requests',':id'] }, description: 'Retrieve a request; localized fields included.' } }
      ]
    },
    {
      name: 'Reviews',
      item: [
        { name: 'Create Review (POST /reviews)', request: { method: 'POST', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' }], body: { mode: 'raw', raw: JSON.stringify({ reviewedUserId: '<userId>', rating: 5, text: 'Great work' }) }, url: { raw: '{{baseUrl}}/reviews', host: ['{{baseUrl}}'], path: ['reviews'] }, description: 'Create a review. text will be stored as localized object.' } },
        { name: 'List Reviews for User (GET /reviews/user/:userId)', request: { method: 'GET', url: { raw: '{{baseUrl}}/reviews/user/:userId', host: ['{{baseUrl}}'], path: ['reviews','user',':userId'] }, description: 'List reviews for a user; review.text is localized.' } }
      ]
    },
    {
      name: 'Disputes',
      item: [
        { name: 'Create Dispute (POST /disputes)', request: { method: 'POST', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' }], body: { mode: 'raw', raw: JSON.stringify({ accusedUser: '<userId>', issueType: 'fraud', description: 'Buyer provided fake documents' }) }, url: { raw: '{{baseUrl}}/disputes', host: ['{{baseUrl}}'], path: ['disputes'] }, description: 'Create a dispute. description stored as localized object.' } },
        { name: 'List Disputes (GET /disputes)', request: { method: 'GET', url: { raw: '{{baseUrl}}/disputes', host: ['{{baseUrl}}'], path: ['disputes'] }, description: 'List disputes; descriptions localized.' } }
      ]
    },
    {
      name: 'Uploads',
      item: [
        { name: 'Attach Files (POST /uploads/attach)', request: { method: 'POST', header: [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }], body: { mode: 'formdata', formdata: [ { key: 'ownerType', value: 'listing', type: 'text' }, { key: 'ownerId', value: '<listingId>', type: 'text' }, { key: 'descriptions', value: JSON.stringify(['Front view','Specs']), type: 'text' }, { key: 'files', type: 'file', src: '<choose file>' } ] }, url: { raw: '{{baseUrl}}/uploads/attach', host: ['{{baseUrl}}'], path: ['uploads','attach'] }, description: 'Attach files to an owner (listing/request/offer). Provide ownerType and ownerId. descriptions may be a JSON array string aligned to files order.' }, response: [ { name: '201 - Files attached', status: 'Created', code: 201, body: JSON.stringify({ success: true, files: [ { filename: 'specs.pdf', originalname: 'specs.pdf', mimeType: 'application/pdf', size: 102400, urlSrc: 'https://.../specs.pdf', publicId: 'p1', description: { en: 'Specs', ar: '' } } ] }) } ] }
      ]
    }
  ]
};
fs.writeFileSync('/Users/brightlazarus/Documents/Github/Backend-Neosoq-app/postman/marketplace_api_collection.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote postman/marketplace_api_collection.json');
