# API Gateway Test Suite

Comprehensive unit tests for the `/api/documents` endpoint covering GET and POST operations.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### GET /api/documents

**Basic Queries** (3 tests)
- Returns all documents with default pagination
- Handles pagination parameters (limit, offset)
- Enforces max limit of 100

**Filtering** (5 tests)
- Filter by document types (docTypes)
- Filter by counties
- Filter by impact level
- Filter by stage
- Filter by topics

**Date Filtering** (2 tests)
- Filter by date range (meetingDateFrom, meetingDateTo)
- Filter by daysBack

**Text Search** (1 test)
- Search across title, entity, topics, and extracted text

**Sorting** (2 tests)
- Default sort by meeting date descending
- Custom sort by createdAt ascending

**Error Handling** (1 test)
- Handles database errors gracefully

**JSON Field Parsing** (2 tests)
- Correctly parses valid JSON fields
- Handles malformed JSON gracefully with defaults

### POST /api/documents

**Valid Requests** (2 tests)
- Create document with all fields
- Create document with only required fields

**Validation** (3 tests)
- Reject missing sourceId
- Reject missing title
- Reject multiple missing required fields

**Duplicate Detection** (1 test)
- Reject duplicate content_hash (409 Conflict)

**Error Handling** (2 tests)
- Handle database errors
- Handle invalid JSON

## Total Test Count

**22 test cases** covering:
- ✅ All query parameters
- ✅ Pagination and limits
- ✅ Filtering by all supported fields
- ✅ Date range filtering
- ✅ Text search
- ✅ Sorting options
- ✅ Request validation
- ✅ Duplicate detection
- ✅ Error handling
- ✅ JSON field parsing
- ✅ Edge cases

## Test Strategy

- **Database Mocking**: All tests mock the database layer using `jest.mock()`
- **Isolation**: Each test is independent and doesn't rely on actual database state
- **Coverage**: Tests cover happy paths, edge cases, and error scenarios
- **Assertions**: Verify response status codes, data structure, and error messages

## Example Test Output

```
PASS  src/app/api/documents/__tests__/route.test.ts
  GET /api/documents
    Basic Queries
      ✓ should return all documents with default pagination
      ✓ should handle pagination parameters
      ✓ should enforce max limit of 100
    Filtering
      ✓ should filter by document types
      ✓ should filter by counties
      ✓ should filter by impact level
      ✓ should filter by stage
      ✓ should filter by topics
    Date Filtering
      ✓ should filter by date range
      ✓ should filter by daysBack
    Text Search
      ✓ should search across multiple fields
    Sorting
      ✓ should sort by meeting date descending by default
      ✓ should sort by createdAt ascending
    Error Handling
      ✓ should handle database errors gracefully
    JSON Field Parsing
      ✓ should parse JSON fields correctly
      ✓ should handle malformed JSON gracefully
  POST /api/documents
    Valid Requests
      ✓ should create a document with all fields
      ✓ should create a document with only required fields
    Validation
      ✓ should reject request with missing sourceId
      ✓ should reject request with missing title
      ✓ should reject request with multiple missing fields
    Duplicate Detection
      ✓ should reject duplicate content_hash
    Error Handling
      ✓ should handle database errors
      ✓ should handle invalid JSON

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

## Maintenance

When adding new features to the API:
1. Add corresponding test cases to this suite
2. Update this README with new test descriptions
3. Ensure all tests pass before merging
