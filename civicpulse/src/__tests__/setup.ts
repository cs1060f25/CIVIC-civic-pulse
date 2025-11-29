/**
 * Jest Test Setup
 * 
 * This file runs before each test suite to set up the testing environment.
 * It handles:
 * - Environment variable configuration for tests
 * - Mock setup for native modules
 * - Database cleanup between tests
 */

import path from 'path';

// Set test environment variables before any modules are loaded
process.env.NODE_ENV = 'test';

// Point to a test database (created fresh for each test run)
process.env.CIVICPULSE_DB_PATH = path.join(__dirname, 'fixtures', 'test.db');

// Increase timeout for database operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Allow any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

