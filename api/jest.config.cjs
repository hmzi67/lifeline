// Default config for `npm test`: every suite in tests/, with the shared TypeScript setup.
// The other jest.*.config.cjs files run named subsets of these (see package.json scripts).
module.exports = {
  ...require('./jest.apple-onboarding.config.cjs'),
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
};
