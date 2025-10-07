module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/setup.js'],
  moduleNameMapper: {
    '^google-auth-library$': '<rootDir>/test/__mocks__/google-auth-library.js'
  }
};
