const fs = require('fs');
const out = {
  info: {
    _postman_id: 'neosoq-marketplace-v2',
    name: 'Neosoq Marketplace API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3500' },
    { key: 'accessToken', value: '' }
  ],
  item: [
    {
      name: 'Auth',
      item: [
        {
          name: 'Verify Login',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            body: { mode: 'raw', raw: JSON.stringify({ phoneNumber: '+1234567890', verificationCode: '123456' }) },
            url: { raw: '{{baseUrl}}/auth/login/verify', host: ['{{baseUrl}}'], path: ['auth','login','verify'] },
            description: 'Returns accessToken and refreshToken'
          },
          response: [ { name: '200', status: 'OK', code: 200, body: JSON.stringify({ accessToken: '<jwt>', refreshToken: '<jwt>', user: { id: '<id>' } }) } ]
        }
      ]
    },
    {
      name: 'Listings',
      item: [
        {
          name: 'Create Listing',
          request: {
            method: 'POST',
            header: [ { key: 'Authorization', value: 'Bearer {{accessToken}}' }, { key: 'Content-Type', value: 'application/json' } ],
            body: { mode: 'raw', raw: JSON.stringify({ category: 'bicycles', title: 'Blue Bicycle', description: 'A well kept blue bicycle', price: 120, files: [] }) },
            url: { raw: '{{baseUrl}}/listings', host: ['{{baseUrl}}'], path: ['listings'] },
            description: 'Create listing; title/description normalized to {en,ar}'
          },
          response: [ { name: '201', status: 'Created', code: 201, body: JSON.stringify({ listing: { _id: '<id>', title: { en: 'Blue Bicycle', ar: '' }, description: { en: 'A well kept blue bicycle', ar: '' }, files: [] } }) } ]
        },
        {
          name: 'Get Listing',
          request: { method: 'GET', url: { raw: '{{baseUrl}}/listings/:id', host: ['{{baseUrl}}'], path: ['listings',':id'] }, description: 'Get listing returns localized fields' },
          response: [ { name: '200', status: 'OK', code: 200, body: JSON.stringify({ listing: { _id: '<id>', title: { en: 'Blue Bicycle', ar: '' }, description: { en: 'A well kept blue bicycle', ar: '' }, files: [ { filename: 'specs.pdf', mimeType: 'application/pdf', size: 102400, urlSrc: 'https://.../specs.pdf', description: { en: 'Specs', ar: '' } } ], createdBy: { id: '<userId>' } } }) } ]
        }
      ]
    },
    {
      name: 'Uploads',
      item: [
        {
          name: 'Attach Files',
          request: {
            method: 'POST',
            header: [ { key: 'Authorization', value: 'Bearer {{accessToken}}' } ],
            body: { mode: 'formdata', formdata: [ { key: 'ownerType', value: 'listing', type: 'text' }, { key: 'ownerId', value: '<listingId>', type: 'text' }, { key: 'descriptions', value: JSON.stringify(['Front view','Specs']), type: 'text' }, { key: 'files', type: 'file', src: '<choose file>' } ] },
            url: { raw: '{{baseUrl}}/uploads/attach', host: ['{{baseUrl}}'], path: ['uploads','attach'] },
            description: 'Attach files to an owner. Provide ownerType and ownerId. descriptions may be a JSON array string aligned to files order.'
          },
          response: [ { name: '201', status: 'Created', code: 201, body: JSON.stringify({ success: true, files: [ { filename: 'specs.pdf', originalname: 'specs.pdf', mimeType: 'application/pdf', size: 102400, urlSrc: 'https://.../specs.pdf', publicId: 'p1', description: { en: 'Specs', ar: '' } } ] }) } ]
        }
      ]
    }
  ]
};
fs.writeFileSync('/Users/brightlazarus/Documents/Github/Backend-Neosoq-app/postman/marketplace_api_collection.json', JSON.stringify(out, null, 2));
console.log('Wrote postman/marketplace_api_collection.json');
