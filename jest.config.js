module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js', '<rootDir>/test/jest.setup.js'],
  moduleNameMapper: {
    '^google-auth-library$': '<rootDir>/test/__mocks__/google-auth-library.js'
  }
};
