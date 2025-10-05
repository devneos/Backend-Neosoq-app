/*
  Migration helper: fixes phoneNumber unique index when null values cause duplicate key errors.
  Run this once (locally or on the server) with:
    node scripts/fixPhoneIndex.js
  It will drop the existing phoneNumber index (if present) and recreate a sparse unique index.
*/

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const coll = mongoose.connection.collection('users');

    // List indexes
    const indexes = await coll.indexes();
    console.log('Existing indexes:', indexes);

    // If an index on phoneNumber exists but is not sparse, drop it
    for (const idx of indexes) {
      if (idx.key && idx.key.phoneNumber === 1) {
        console.log('Found phoneNumber index:', idx);
        // Drop it to recreate with sparse:true
        if (!idx.sparse || !idx.unique) {
          await coll.dropIndex(idx.name);
          console.log('Dropped index', idx.name);
        } else {
          console.log('phoneNumber index already sparse+unique; nothing to do');
        }
      }
    }

    // Ensure the sparse unique index exists
    try {
      await coll.createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });
      console.log('Created sparse unique index on phoneNumber');
    } catch (e) {
      console.error('Error creating index:', e.message);
    }

    // Ensure googleId index too
    try {
      await coll.createIndex({ googleId: 1 }, { unique: true, sparse: true });
      console.log('Created sparse unique index on googleId');
    } catch (e) {
      console.error('Error creating googleId index:', e.message);
    }

    await mongoose.disconnect();
    console.log('Done');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
