const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

module.exports = async () => {
  // Start in-memory mongo
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Expose stop function
  global.__MONGOSERVER__ = mongoServer;
};
