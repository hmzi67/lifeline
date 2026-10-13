module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/tests/google-auth.setup.cjs'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/googleMobileAuth.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          module: 'CommonJS',
          moduleResolution: 'Node',
          rootDir: '../..',
          skipLibCheck: true,
          strict: true,
          target: 'ES2022',
          types: ['node', 'jest'],
        },
      },
    ],
  },
};
