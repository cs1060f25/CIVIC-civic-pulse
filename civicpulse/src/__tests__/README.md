# CivicPulse Test Suite

This test suite covers critical functionality of the CivicPulse application, with special focus on database connectivity and the document API.

## Background

These tests were created to prevent a recurring issue where the `better-sqlite3` native module failed to load correctly with Next.js bundlers (especially Turbopack). The symptoms were:

- API endpoints returning empty document lists
- "Could not locate the bindings file" errors in server logs
- Version mismatch warnings for `better-sqlite3`

## Test Files

### `lib/db.test.ts` - Database Connection Tests

Tests that verify the `better-sqlite3` native module works correctly:

- **Native Module Loading**: Verifies that `better-sqlite3` can be imported and instantiated
- **Database Operations**: Tests CRUD operations, transactions, and SQL execution
- **Schema Compatibility**: Ensures the test schema matches production
- **Path Resolution**: Tests database file path resolution logic
- **Edge Cases**: Handles multiple connections, readonly mode, close behavior

### `lib/document-utils.test.ts` - Document Utility Tests

Tests for data transformation utilities:

- **parseJSON**: Safe JSON parsing with fallback defaults
- **transformRow**: Database row to API response transformation
- **Null Handling**: Proper defaults for missing fields
- **Type Coercion**: Correct handling of impact levels, arrays, objects

### `api/counties.test.ts` - Counties API Tests

Tests for the `/api/counties` endpoint:

- **County Extraction**: Parses JSON arrays from document_metadata.counties
- **Deduplication**: Ensures unique counties across all documents
- **Sorting**: Alphabetical ordering of county names
- **Edge Cases**: Empty arrays, malformed JSON, whitespace handling
- **Filter Integration**: Verifies county filter works in document queries

### `components/CountyPicker.test.ts` - CountyPicker Component Tests

Tests for the CountyPicker component logic:

- **County Filtering**: Case-insensitive search, exclusion of selected
- **Selection Management**: Add/remove counties, prevent duplicates
- **Text Highlighting**: Match highlighting for autocomplete
- **Keyboard Navigation**: Escape, Backspace, Enter key handling
- **API Response Handling**: Processing counties endpoint response
- **Search Integration**: URL parameter building with counties filter

### `api/documents.test.ts` - API Route Tests

Integration tests for the documents API using an in-memory database:

- **Query Building**: Filter by text, document type, date range, impact
- **Document Creation**: Insert with transactions, duplicate detection
- **Document Retrieval**: Fetch by ID, handle missing documents
- **Pagination**: Limit/offset functionality
- **Error Handling**: SQL injection prevention, missing tables

### `config/next-config.test.ts` - Configuration Tests

Ensures the Next.js config properly handles native modules:

- **serverExternalPackages**: Verifies `better-sqlite3` is excluded from bundling
- **webpack externals**: Confirms fallback configuration exists
- **Development Scripts**: Ensures `npm run dev` doesn't use Turbopack by default
- **Native Bindings**: Checks that compiled `.node` files exist

## Running Tests

```bash
# From civicpulse/ directory

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

Coverage is enforced for critical utility files:

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `document-utils.ts` | 100% | 90%+ | 100% | 100% |

## Adding New Tests

When adding tests:

1. Place test files in `src/__tests__/` mirroring the source structure
2. Use the naming convention `*.test.ts`
3. For database tests, use in-memory SQLite (`':memory:'`)
4. Apply the production schema from `backend/db/schema.sql`
5. Clean up resources in `afterEach`/`afterAll` hooks

## Preventing Regression

These tests specifically guard against:

1. **Native Module Bundling Issues**
   - `config/next-config.test.ts` verifies `serverExternalPackages` config
   - Tests that `better-sqlite3` is loadable at runtime

2. **Database Connection Failures**
   - `lib/db.test.ts` tests all database operations
   - Validates schema compatibility

3. **API Response Correctness**
   - `api/documents.test.ts` tests query logic
   - `lib/document-utils.test.ts` tests data transformation

## Troubleshooting

### Tests fail with "Could not locate the bindings file"

The native module isn't compiled properly. Run:
```bash
npm rebuild better-sqlite3
```

### Tests fail with schema errors

The test schema may be out of sync with production. Update the schema in test files to match `backend/db/schema.sql`.

### Coverage check fails

Ensure `document-utils.ts` maintains 100% coverage. Missing test cases will fail CI.

