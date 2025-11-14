# CivicPulse Frontend Testing Guide

This document provides comprehensive information about testing the CivicPulse frontend module (Next.js application).

## Overview

The frontend test suite uses **Jest** as the testing framework with full TypeScript support. Tests are designed to be:

- **Fast**: All tests use mocked database connections
- **Isolated**: Each test is independent and doesn't affect others
- **Comprehensive**: Covers happy paths, edge cases, and error scenarios
- **Maintainable**: Clear structure and naming conventions

### Current Coverage

- **22 test cases** across GET and POST endpoints
- **100% endpoint coverage** for `/api/documents`
- **Mocked database layer** for speed and reliability

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later

## Getting Started

### Installation

Testing dependencies are already included in `package.json`. If you need to reinstall:

```bash
cd src/app
npm install
```

### First Test Run

```bash
cd src/app
npm test
```

Expected output:
```
PASS  app/api/documents/__tests__/route.test.ts
  GET /api/documents
    ✓ Basic Queries (3 tests)
    ✓ Filtering (5 tests)
    ✓ Date Filtering (2 tests)
    ✓ Text Search (1 test)
    ✓ Sorting (2 tests)
    ✓ Error Handling (1 test)
    ✓ JSON Field Parsing (2 tests)
  POST /api/documents
    ✓ Valid Requests (2 tests)
    ✓ Validation (3 tests)
    ✓ Duplicate Detection (1 test)
    ✓ Error Handling (2 tests)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        2.5s
```

## Test Structure

### Directory Layout

```
src/app/
├── app/
│   └── api/
│       └── documents/
│           ├── __tests__/
│           │   ├── route.test.ts       # Main test file
│           │   └── README.md           # Test-specific docs
│           └── route.ts                 # API implementation
├── jest.config.js                      # Jest configuration
├── jest.setup.js                       # Test setup/globals
└── TESTING.md                          # This file
```

## Running Tests

### Basic Commands

```bash
cd src/app

# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Advanced Options

```bash
# Run specific test file
npm test -- route.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should filter by"

# Run tests with verbose output
npm test -- --verbose

# Update snapshots (if using snapshot testing)
npm test -- --updateSnapshot
```

### Coverage Report

```bash
npm run test:coverage
```

This generates:
- Console summary
- HTML report in `coverage/` directory
- Coverage data for CI/CD integration

**Coverage Goals:**
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

## Test Schema

### GET /api/documents Tests

#### 1. Basic Queries (3 tests)
- Default pagination
- Custom pagination
- Max limit enforcement

#### 2. Filtering (5 tests)
- Document types filter
- Counties filter
- Impact level filter
- Stage filter
- Topics filter

#### 3. Date Filtering (2 tests)
- Date range filter
- Days back filter

#### 4. Text Search (1 test)
- Multi-field search across title, entity, topics, extracted_text

#### 5. Sorting (2 tests)
- Default sort
- Custom sort options

#### 6. Error Handling (1 test)
- Database error handling

#### 7. JSON Field Parsing (2 tests)
- Valid JSON parsing
- Malformed JSON handling

### POST /api/documents Tests

#### 1. Valid Requests (2 tests)
- All fields provided
- Required fields only

#### 2. Validation (3 tests)
- Missing required fields
- Field validation errors

#### 3. Duplicate Detection (1 test)
- Duplicate content hash prevention

#### 4. Error Handling (2 tests)
- Database errors
- Invalid JSON handling

## Writing New Tests

### Test Template

```typescript
describe("Feature Name", () => {
  it("should do something specific", async () => {
    // Arrange: Set up mocks and test data
    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockReturnValue({ /* mock data */ }),
    } as any);

    // Act: Execute the code under test
    const request = new NextRequest("http://localhost:3000/api/documents?param=value");
    const response = await GET(request);
    const data = await response.json();

    // Assert: Verify the results
    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(1);
  });
});
```

### Best Practices

1. **One assertion per test** (when possible)
2. **Use descriptive test names** starting with "should"
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Mock external dependencies** (database, APIs)
5. **Clean up after tests** using `beforeEach()`

## Mocking Strategy

### Database Mocking

The test suite mocks the entire database layer:

```typescript
jest.mock("@/lib/db");

const mockDb = {
  prepare: jest.fn(),
  transaction: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn(),
};

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;
mockGetDb.mockReturnValue(mockDb as any);
```

### Why Mock the Database?

1. **Speed**: Tests run in milliseconds instead of seconds
2. **Isolation**: Tests don't depend on database state
3. **Reliability**: No flaky tests due to database issues
4. **Simplicity**: No need for test database setup/teardown

## Troubleshooting

### "Cannot find module '@/lib/db'"

**Solution**: Check `jest.config.js` has correct module mapping:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

### Tests timeout

**Solution**: Increase timeout in test:
```typescript
it("should do something", async () => {
  // test code
}, 10000); // 10 second timeout
```

### Mock not working

**Solution**: Ensure `jest.clearAllMocks()` is called in `beforeEach()`:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockGetDb.mockReturnValue(mockDb as any);
});
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Next.js Applications](https://nextjs.org/docs/testing)
- [TypeScript with Jest](https://jestjs.io/docs/getting-started#using-typescript)
