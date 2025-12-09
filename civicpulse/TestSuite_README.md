# CivicPulse Test Suite Summary

## Overview

The test suite includes unit and integration tests for the CivicPulse application. All tests run with a single command: `npm test`.

## Test Suite Structure

### Unit Tests (5+ Functions Covered)

#### 1. **Document Utilities** (`src/__tests__/lib/document-utils.test.ts`)
- `parseJSON()`: Parses JSON strings with error handling
  - Valid JSON parsing
  - Invalid JSON fallback to defaults
  - Null/undefined handling
  - Nested objects and arrays
- `transformRow()`: Transforms database rows to API format
  - Field mapping (snake_case → camelCase)
  - JSON field parsing (counties, topics, keyword_hits, etc.)
  - Null value defaults
  - Edge cases (invalid JSON, missing fields)

#### 2. **Format Utilities** (`src/__tests__/lib/format.test.ts`)
- `formatTopicLabel()`: Converts slugs to human-readable labels
  - Hyphen/underscore conversion (`"land-use"` → `"Land Use"`)
  - Lowercase word preservation ("and", "of", "for")
  - Edge cases (empty strings, whitespace)
- `formatHitLabel()`: Formats labels with counts
  - Numeric value formatting (`"zoning"` → `"Zoning (5)"`)
  - Object value aggregation
  - Fallback behavior without counts

#### 3. **App State Defaults** (`src/__tests__/lib/appStateDefaults.test.ts`)
- `normalizeAppState()`: Normalizes application state
  - Fills missing fields from defaults
  - Preserves provided fields
  - Immutability (doesn't mutate input)
  - Nested object normalization (`searchUi`)

#### 4. **Database Module** (`src/__tests__/lib/db.test.ts`)
- Database connection and path resolution
- Schema compatibility and foreign keys
- Transaction handling
- Edge cases (readonly mode, close operations)

#### 5. **Component Logic** (`src/__tests__/components/CountyPicker.test.ts`)
- County filtering and selection management
- Query matching and exclusion logic

### Integration Tests (2 API Routes)

#### 1. **Documents API** (`src/__tests__/api/documents.test.ts`)
- Database query building (filters, pagination, sorting)
- Document creation and duplicate prevention
- Document retrieval by ID
- Error handling (SQL injection, missing tables)
- **Integration test**: Calls actual `GET` handler from `@app/api/documents/route`
  - Verifies response structure: `{ documents: [...], pagination: {...} }`
  - Asserts test documents appear correctly

#### 2. **Counties API** (`src/__tests__/api/counties.test.ts`)
- County extraction from JSON arrays
- Deduplication and sorting
- Edge cases (malformed JSON, empty arrays)
- **Integration test**: Calls actual `GET` handler from `@app/api/counties/route`
  - Verifies response structure: `{ counties: [...] }`
  - Asserts counties are sorted and unique

### Configuration Tests

- **Next.js Config** (`src/__tests__/config/next-config.test.ts`): Verifies Next.js configuration for native modules

## Test Statistics

- **Total Test Suites**: 8
- **Total Tests**: 149
- **Test Framework**: Jest with TypeScript support
- **Test Environment**: Node.js (in-memory SQLite databases)
- **Coverage**: Focused on critical utility files

## How to Run Tests

### Prerequisites

1. **Node.js** 18.x or later
2. **npm** 9.x or later

### Step-by-Step Instructions

1. **Clone the repository:**
```bash
git clone https://github.com/cs1060f25/CIV-civic-pulse.git
cd CIV-civic-pulse
```

2. **Navigate to the frontend directory:**
```bash
cd civicpulse
```

3. **Install dependencies:**
```bash
npm install
```

4. **Run all tests:**
```bash
npm test
```

### Expected Output

When tests pass successfully, you should see:
```
PASS src/__tests__/lib/document-utils.test.ts
PASS src/__tests__/api/documents.test.ts
PASS src/__tests__/api/counties.test.ts
PASS src/__tests__/lib/db.test.ts
PASS src/__tests__/components/CountyPicker.test.ts
PASS src/__tests__/config/next-config.test.ts
PASS src/__tests__/lib/format.test.ts
PASS src/__tests__/lib/appStateDefaults.test.ts

Test Suites: 8 passed, 8 total
Tests:       149 passed, 149 total
Snapshots:   0 total
Time:        ~1.5s
```

### Additional Test Commands

- **Watch mode** (re-runs tests on file changes):
```bash
npm run test:watch
```

- **Coverage report**:
```bash
npm run test:coverage
```

### Notes

- **No database setup required**: Tests use in-memory SQLite databases
- **No environment variables needed**: Tests configure themselves
- **Fast execution**: All tests complete in ~1-2 seconds
- **Isolated**: Each test uses a fresh database instance

## Test Architecture

- **Mocking**: Database module is mocked to use in-memory SQLite
- **Isolation**: Each test suite gets a fresh database in `beforeEach`
- **Type Safety**: Full TypeScript support with type checking
- **Deterministic**: All tests are deterministic (no random data or timing dependencies)

## Key Features Tested

1. **Data transformation**: Database rows → API response format
2. **JSON parsing**: Safe parsing with fallbacks
3. **Formatting**: Slug-to-label conversion and hit label formatting
4. **State management**: App state normalization and defaults
5. **API integration**: Full request/response cycle for documents and counties endpoints
6. **Database operations**: CRUD operations, transactions, constraints
7. **Error handling**: Invalid inputs, missing data, edge cases

The test suite ensures core functionality works correctly and helps prevent regressions during development.

