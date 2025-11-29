/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
      },
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
  ],
  collectCoverageFrom: [
    'src/app/lib/**/*.ts',
    '!src/**/*.d.ts',
  ],
  // Only enforce coverage on critical utility files
  // API routes are tested via integration tests
  coverageThreshold: {
    './src/app/lib/document-utils.ts': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  // Handle native modules
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(better-sqlite3)/)',
  ],
};

module.exports = config;

