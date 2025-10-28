# CivicPulse Testing Documentation

This document provides comprehensive information about the test suite for the CivicPulse API Gateway.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Schema](#test-schema)
- [Writing New Tests](#writing-new-tests)
- [Mocking Strategy](#mocking-strategy)
- [Coverage Goals](#coverage-goals)

---

## Overview

The CivicPulse test suite uses **Jest** as the testing framework with full TypeScript support. Tests are designed to be:

- **Fast**: All tests use mocked database connections
- **Isolated**: Each test is independent and doesn't affect others
- **Comprehensive**: Covers happy paths, edge cases, and error scenarios
- **Maintainable**: Clear structure and naming conventions

### Current Coverage

- **22 test cases** across GET and POST endpoints
- **100% endpoint coverage** for `/api/documents`
- **Mocked database layer** for speed and reliability

---

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later

### Installation

Testing dependencies are already included in `package.json`. If you need to reinstall:

```bash
npm install
```

### First Test Run

```bash
npm test
```

Expected output:
```
PASS  src/app/api/documents/__tests__/route.test.ts
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

---

## Test Structure

### Directory Layout

```
civicpulse/
├── src/
│   └── app/
│       └── api/
│           └── documents/
│               ├── __tests__/
│               │   ├── route.test.ts       # Main test file
│               │   └── README.md           # Test-specific docs
│               └── route.ts                # API implementation
├── jest.config.js                          # Jest configuration
├── jest.setup.js                           # Test setup/globals
└── TESTING.md                              # This file
```

### Test File Organization

Each test file follows this structure:

```typescript
// 1. Imports
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { getDb } from "@/lib/db";

// 2. Mocks
jest.mock("@/lib/db");

// 3. Test suites
describe("GET /api/documents", () => {
  describe("Feature Group", () => {
    it("should do something specific", async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## Running Tests

### Basic Commands

```bash
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

---

## Test Schema

### GET /api/documents Tests

#### 1. Basic Queries (3 tests)

| Test | Purpose | Assertions |
|------|---------|------------|
| Default pagination | Verify default limit=50, offset=0 | Status 200, correct pagination object |
| Custom pagination | Test limit and offset parameters | Correct limit/offset in response |
| Max limit enforcement | Ensure limit never exceeds 100 | limit capped at 100 even if requested higher |

#### 2. Filtering (5 tests)

| Test | Purpose | Query Params | Expected Behavior |
|------|---------|--------------|-------------------|
| Document types | Filter by docTypes | `?docTypes=Agenda,Minutes` | SQL contains `m.doc_types LIKE ?` |
| Counties | Filter by counties | `?counties=Johnson,Sedgwick` | SQL contains `m.counties LIKE ?` |
| Impact level | Filter by impact | `?impact=High,Medium` | SQL contains `m.impact IN (?, ?)` |
| Stage | Filter by stage | `?stage=Hearing,Vote` | SQL contains `m.stage IN (?, ?)` |
| Topics | Filter by topics | `?topics=zoning,education` | SQL contains `m.topics LIKE ?` |

#### 3. Date Filtering (2 tests)

| Test | Purpose | Query Params | Expected SQL |
|------|---------|--------------|--------------|
| Date range | Filter by start/end dates | `?meetingDateFrom=2025-10-01&meetingDateTo=2025-10-31` | `m.meeting_date >= ?` AND `m.meeting_date <= ?` |
| Days back | Filter by last N days | `?daysBack=30` | `m.meeting_date >= ?` (calculated date) |

#### 4. Text Search (1 test)

| Test | Purpose | Query Params | Fields Searched |
|------|---------|--------------|-----------------|
| Multi-field search | Search across text fields | `?query=solar` | title, entity, topics, extracted_text |

#### 5. Sorting (2 tests)

| Test | Purpose | Query Params | Expected ORDER BY |
|------|---------|--------------|-------------------|
| Default sort | Verify default sorting | (none) | `ORDER BY m.meeting_date DESC` |
| Custom sort | Test custom sort options | `?sortBy=createdAt&sortOrder=asc` | `ORDER BY d.created_at ASC` |

#### 6. Error Handling (1 test)

| Test | Purpose | Trigger | Expected Response |
|------|---------|---------|-------------------|
| Database error | Handle DB failures | Mock throws error | 500 status, error message |

#### 7. JSON Field Parsing (2 tests)

| Test | Purpose | Input | Expected Output |
|------|---------|-------|-----------------|
| Valid JSON | Parse JSON fields | `'["Johnson", "Sedgwick"]'` | `["Johnson", "Sedgwick"]` (array) |
| Malformed JSON | Handle bad JSON | `'invalid json'` | `[]` (default empty array) |

### POST /api/documents Tests

#### 1. Valid Requests (2 tests)

| Test | Purpose | Request Body | Expected Response |
|------|---------|--------------|-------------------|
| All fields | Create with complete data | All optional + required fields | 201 status, full document object |
| Required only | Create with minimal data | Only required fields | 201 status, defaults for optional fields |

**Required Fields:**
- `sourceId`
- `fileUrl`
- `contentHash`
- `bytesSize`
- `title`
- `entity`
- `jurisdiction`

#### 2. Validation (3 tests)

| Test | Missing Field(s) | Expected Response |
|------|------------------|-------------------|
| Missing sourceId | `sourceId` | 400 status, `fields.sourceId: "Required"` |
| Missing title | `title` | 400 status, `fields.title: "Required"` |
| Multiple missing | Multiple required fields | 400 status, multiple field errors |

#### 3. Duplicate Detection (1 test)

| Test | Purpose | Trigger | Expected Response |
|------|---------|---------|-------------------|
| Duplicate hash | Prevent duplicate documents | Same `contentHash` as existing | 409 status, `DUPLICATE_DOCUMENT` error |

#### 4. Error Handling (2 tests)

| Test | Purpose | Trigger | Expected Response |
|------|---------|---------|-------------------|
| Database error | Handle DB failures | Mock throws error | 500 status, error message |
| Invalid JSON | Handle malformed request | Invalid JSON body | 500 status, error message |

---

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
   - Makes failures easier to diagnose
   - Tests are more focused

2. **Use descriptive test names**
   - Start with "should"
   - Describe the expected behavior
   - Example: `"should filter by impact level"`

3. **Follow AAA pattern**
   - **Arrange**: Set up test data and mocks
   - **Act**: Execute the code
   - **Assert**: Verify the results

4. **Mock external dependencies**
   - Always mock database calls
   - Mock external APIs
   - Use `jest.mock()` for modules

5. **Clean up after tests**
   - Use `beforeEach()` to reset mocks
   - Clear mock call history

### Adding a New Test

1. **Identify the feature** to test
2. **Determine test category** (filtering, validation, etc.)
3. **Write the test** following the template
4. **Run the test** to verify it works
5. **Update documentation** (this file and test README)

Example:
```typescript
describe("Filtering", () => {
  it("should filter by new field", async () => {
    // Setup mock
    mockDb.prepare.mockReturnValueOnce({
      get: jest.fn().mockReturnValue({ total: 1 }),
    } as any);

    mockDb.prepare.mockReturnValueOnce({
      all: jest.fn().mockReturnValue([]),
    } as any);

    // Make request
    const request = new NextRequest(
      "http://localhost:3000/api/documents?newField=value"
    );
    await GET(request);

    // Verify SQL was built correctly
    const prepareCall = mockDb.prepare.mock.calls[1];
    expect(prepareCall[0]).toContain("m.new_field = ?");
  });
});
```

---

## Mocking Strategy

### Database Mocking

The test suite mocks the entire database layer using Jest:

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

### Mock Patterns

#### Pattern 1: Mock Query Result

```typescript
mockDb.prepare.mockReturnValueOnce({
  get: jest.fn().mockReturnValue({ total: 10 }),
} as any);
```

#### Pattern 2: Mock Multiple Queries

```typescript
// First query (count)
mockDb.prepare.mockReturnValueOnce({
  get: jest.fn().mockReturnValue({ total: 5 }),
} as any);

// Second query (data)
mockDb.prepare.mockReturnValueOnce({
  all: jest.fn().mockReturnValue([/* documents */]),
} as any);
```

#### Pattern 3: Mock Transaction

```typescript
const mockTransaction = jest.fn((cb) => cb());
mockDb.transaction.mockReturnValue(mockTransaction);

mockDb.prepare.mockReturnValueOnce({
  run: jest.fn(),
} as any);
```

#### Pattern 4: Mock Error

```typescript
mockDb.prepare.mockImplementation(() => {
  throw new Error("Database connection failed");
});
```

---

## Coverage Goals

### Current Coverage

Run `npm run test:coverage` to see detailed coverage report.

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Statements | > 80% | Check with coverage report |
| Branches | > 75% | Check with coverage report |
| Functions | > 80% | Check with coverage report |
| Lines | > 80% | Check with coverage report |

### Uncovered Areas

Areas that may need additional test coverage:
- [ ] Edge cases for very large datasets (pagination)
- [ ] Concurrent request handling
- [ ] Performance under load (integration tests)
- [ ] Database connection failures and retries

---

## Continuous Integration

### Running Tests in CI/CD

Add to your CI pipeline (e.g., GitHub Actions):

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

### Pre-commit Hooks

Consider adding tests to pre-commit hooks:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module '@/lib/db'"

**Solution**: Check `jest.config.js` has correct module mapping:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

#### Issue: Tests timeout

**Solution**: Increase timeout in test:
```typescript
it("should do something", async () => {
  // test code
}, 10000); // 10 second timeout
```

#### Issue: Mock not working

**Solution**: Ensure `jest.clearAllMocks()` is called in `beforeEach()`:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  mockGetDb.mockReturnValue(mockDb as any);
});
```

#### Issue: TypeScript errors in tests

**Solution**: Ensure `@types/jest` is installed:
```bash
npm install --save-dev @types/jest
```

---

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Next.js Applications](https://nextjs.org/docs/testing)
- [TypeScript with Jest](https://jestjs.io/docs/getting-started#using-typescript)
- [API Route Testing Best Practices](https://nextjs.org/docs/pages/building-your-application/routing/api-routes#testing)

---

## Maintenance

### When to Update Tests

- ✅ Adding new API endpoints
- ✅ Modifying existing endpoint behavior
- ✅ Adding new query parameters
- ✅ Changing validation rules
- ✅ Updating error handling

### Test Review Checklist

Before merging code with tests:
- [ ] All tests pass
- [ ] New features have corresponding tests
- [ ] Coverage hasn't decreased
- [ ] Test names are descriptive
- [ ] Mocks are properly cleaned up
- [ ] Documentation is updated

---

## Contact

For questions about testing:
- Review this documentation
- Check test file comments
- Ask the development team
- Create an issue on GitHub
