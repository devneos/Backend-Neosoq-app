const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup a minimal app using the existing routes
const app = require('../server');

describe('POST /listings', () => {
  test('happy path - create listing with allowed file', async () => {
    const res = await request(app)
      .post('/listings')
      .field('category', 'books')
      .field('title', 'Test Book')
      .attach('files', path.join(__dirname, '__fixtures__', 'sample.pdf'));

    expect(res.statusCode).toBe(201);
    expect(res.body.listing).toBeDefined();
    expect(res.body.listing.title).toBe('Test Book');
  });

  test('invalid file type should return 400', async () => {
    const res = await request(app)
      .post('/listings')
      .field('category', 'books')
      .field('title', 'Bad File')
      .attach('files', path.join(__dirname, '__fixtures__', 'bad.txt'));

    expect(res.statusCode).toBe(400);
  });
});
