# AGENTS.md - CivicPulse Project Context

## Project Overview

**CivicPulse** is a platform that tracks local government documents and policy changes across Kansas. The system aggregates agendas, minutes, ordinances, and other public documents from county and city meetings, making it easy to discover local trends before they break nationally.

### Core Mission

CivicPulse helps citizens, journalists, and researchers:
- Track policy changes at the local level
- Discover trends in local government decisions
- Search and filter government documents by various criteria
- Build briefs of relevant documents for analysis

### Technology Stack

**Frontend:**
- Next.js 15 with React 19
- TypeScript
- TailwindCSS for styling
- better-sqlite3 for database access

**Backend:**
- Python 3.9+ for document ingestion and processing
- SQLite database for document storage
- PyYAML for configuration management
- PyMuPDF, Pillow, and Tesseract OCR for PDF processing

**Testing:**
- Jest for frontend/API testing
- pytest for backend Python testing
- ESLint for code quality

## Project Structure

```
CIVIC-civic-pulse/
├── backend/
│   ├── configs/              # YAML configuration files for different sources
│   │   ├── schema.json       # JSON schema for config validation
│   │   ├── wichita_city_council.yaml
│   │   ├── clay_county.yaml
│   │   └── ...
│   ├── data/                 # SQLite database and raw documents
│   │   ├── civicpulse.db    # Main database
│   │   └── raw notes/       # Scraped PDF files organized by source
│   ├── db/
│   │   └── schema.sql       # Database schema definitions
│   ├── ingestion/           # Document scraping and ingestion scripts
│   │   ├── config_loader.py
│   │   ├── local_db.py
│   │   ├── single_link_scraper.py
│   │   ├── page_scraper.py
│   │   └── civicweb_scraper.py
│   ├── processing/           # PDF text extraction and OCR
│   │   └── pdf_processor.py
│   └── tests/                # Backend Python tests
│       ├── test_ingestion_basic.py
│       ├── test_local_db.py
│       └── test_pdf_processor_unit.py
├── civicpulse/               # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── documents/  # API routes for document CRUD
│   │   │   ├── search/         # Search UI page
│   │   │   ├── brief/          # Brief builder page
│   │   │   └── item/[id]/      # Individual document view
│   │   ├── components/         # React components
│   │   └── lib/                # Utilities, types, database connection
│   ├── jest.config.js
│   ├── jest.setup.js
│   └── package.json
└── README.md
```

## Key Components

### Frontend (Next.js)

- **API Routes** (`src/app/api/documents/`): RESTful API for document queries and creation
- **Search Interface** (`src/app/search/`): Filterable document search with date ranges, counties, document types, etc.
- **Brief Builder** (`src/app/brief/`): Allows users to compile selected documents into a brief
- **Database Layer** (`src/lib/db.ts`): SQLite connection and query utilities

### Backend (Python)

- **Ingestion Pipeline**: Scrapes government websites for PDF documents
  - Config-driven scraping with YAML configuration files
  - Duplicate detection based on content hashing
  - Domain validation and PDF content verification
- **Processing Pipeline**: Extracts text from PDFs
  - Native text extraction
  - OCR fallback using Tesseract for scanned documents
  - Keyword counting and analysis

### Database Schema

Two main tables:
- **`documents`**: Core document metadata (id, source_id, file_url, content_hash, bytes_size, created_at)
- **`document_metadata`**: Rich metadata (title, entity, jurisdiction, counties, meeting_date, doc_types, topics, impact, stage, etc.)

## Development Context

### Working Directory Conventions

**Important**: Most Python scripts in `backend/ingestion/` assume the current working directory is `backend/`. Always run Python scripts from the `backend/` directory:

```bash
cd backend
python ingestion/config_loader.py ...
```

### Configuration System

Each government source (e.g., Wichita City Council, Clay County) has a YAML configuration file in `backend/configs/` that defines:
- Source identification
- Allowed domains for scraping
- Date selection rules
- Link selectors and patterns
- File naming conventions

### Database Initialization

The database is automatically initialized on first use, or can be manually created:

```bash
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

## Testing Instructions

### Continuous Integration Plan

**Current Status**: This project does not currently have a CI/CD pipeline configured. 

**Recommended CI Setup** (for future implementation):

1. **GitHub Actions Workflow** should include:
   - Install Node.js dependencies and run frontend tests
   - Install Python dependencies and run backend tests
   - Run linters (ESLint for frontend)
   - Generate and upload test coverage reports
   - Optionally: Run tests on multiple Node.js and Python versions

2. **Pre-commit Hooks** (recommended):
   - Run ESLint on staged files
   - Run frontend tests
   - Run backend tests
   - Prevent commits if tests fail

3. **Pull Request Checks**:
   - All tests must pass
   - Code coverage should not decrease
   - Linter must pass with no errors

### Running Tests

#### Frontend Tests (Jest)

**Location**: `civicpulse/src/app/api/documents/__tests__/route.test.ts`

**Run all frontend tests:**
```bash
cd civicpulse
npm test
```

**Run tests in watch mode** (auto-rerun on file changes):
```bash
npm run test:watch
```

**Run tests with coverage report:**
```bash
npm run test:coverage
```

**Run specific test file:**
```bash
npm test -- route.test.ts
```

**Run tests matching a pattern:**
```bash
npm test -- --testNamePattern="should filter by"
```

**Current Test Coverage:**
- 22 test cases covering GET and POST `/api/documents` endpoints
- 100% endpoint coverage for the documents API
- Tests use mocked database connections for speed and isolation

**Test Structure:**
- Tests are organized by endpoint (GET, POST)
- Each test group covers: basic queries, filtering, validation, error handling
- All database interactions are mocked using Jest

#### Backend Tests (pytest)

**Location**: `backend/tests/`

**Run all backend tests:**
```bash
cd backend
pytest tests/
```

**Run specific test file:**
```bash
pytest tests/test_ingestion_basic.py
```

**Run with verbose output:**
```bash
pytest tests/ -v
```

**Run with coverage:**
```bash
pytest tests/ --cov=ingestion --cov=processing
```

**Test Files:**
- `test_ingestion_basic.py`: Tests config validation, date calculation, duplicate prevention, and single-link scraping
- `test_local_db.py`: Tests database initialization and document storage
- `test_pdf_processor_unit.py`: Tests PDF text extraction and OCR functionality

**Backend Test Requirements:**
- Python 3.9+ (tested with 3.13 on macOS)
- Dependencies: `pytest`, `pyyaml` (and other project dependencies)
- Tests use temporary databases and mocked network calls

### Running Linters and Static Analysis

#### Frontend Linting (ESLint)

**Run ESLint:**
```bash
cd civicpulse
npm run lint
```

**ESLint Configuration:**
- Uses Next.js recommended ESLint config (`next/core-web-vitals`, `next/typescript`)
- Configuration file: `civicpulse/eslint.config.mjs`
- Automatically checks TypeScript, React, and Next.js best practices

**Fix auto-fixable issues:**
```bash
npm run lint -- --fix
```

#### Backend Static Analysis

**Python Code Quality:**
- Currently no automated linter configured
- Recommended: Add `pylint`, `flake8`, or `black` for code formatting
- Type checking: Consider adding `mypy` for type validation

**Manual Code Review Checklist:**
- Follow PEP 8 style guidelines
- Use type hints where appropriate
- Ensure proper error handling
- Validate all user inputs

### When to Update Tests

**You SHOULD update tests when:**

1. **Adding new API endpoints**
   - Create new test file in `civicpulse/src/app/api/[endpoint]/__tests__/`
   - Follow existing test patterns and structure

2. **Modifying existing endpoint behavior**
   - Update corresponding test cases to reflect new behavior
   - Add new test cases for new functionality

3. **Adding new query parameters or filters**
   - Add test cases to verify the new parameter works correctly
   - Test edge cases (empty values, invalid formats, etc.)

4. **Changing validation rules**
   - Update validation tests to reflect new rules
   - Add tests for new validation scenarios

5. **Updating error handling**
   - Ensure error cases are properly tested
   - Verify error messages and status codes

6. **Adding new backend features**
   - Create corresponding pytest tests in `backend/tests/`
   - Test both happy paths and error cases

7. **Modifying database schema**
   - Update tests that depend on schema structure
   - Add migration tests if applicable

**You should NOT update tests when:**
- The change is purely cosmetic (UI styling, text changes)
- The change doesn't affect functionality
- You're only updating documentation or comments

### Instructions: DO NOT Change Existing Tests

**CRITICAL**: Do not modify existing tests unless explicitly requested by the user or when fixing a bug that the test itself contains.

**Rules for Test Modifications:**

1. **Never delete or disable existing tests** without explicit user approval
2. **Never change test assertions** to make them pass when the code is broken
3. **Never modify test logic** to accommodate new code that breaks existing functionality
4. **If a test fails**, investigate why:
   - Is the code broken? → Fix the code
   - Is the test outdated? → Update the test only if the old behavior is no longer valid
   - Is the test itself buggy? → Fix the test, but preserve its original intent

**When you MUST update a test:**
- The user explicitly asks you to update it
- The test is testing deprecated functionality that has been removed
- The test contains a bug that prevents it from running correctly
- The test is testing behavior that has intentionally changed (documented in PR/issue)

**Best Practice:**
- When in doubt, ask the user before modifying tests
- Preserve test coverage - if removing a test, ensure the functionality is still covered elsewhere
- Document why a test was changed in commit messages

### Test Maintenance Guidelines

1. **Keep tests fast**: Use mocks for external dependencies (database, network calls)
2. **Keep tests isolated**: Each test should be independent and not rely on other tests
3. **Use descriptive test names**: Test names should clearly describe what they're testing
4. **Follow AAA pattern**: Arrange (setup), Act (execute), Assert (verify)
5. **Test edge cases**: Include tests for boundary conditions, empty inputs, invalid data
6. **Maintain test coverage**: Aim for >80% coverage on critical paths

### Other Relevant Instructions

#### Code Style

**Frontend (TypeScript/React):**
- Use TypeScript strict mode
- Follow React best practices (hooks, functional components)
- Use TailwindCSS for styling (avoid inline styles)
- Follow Next.js conventions for file structure

**Backend (Python):**
- Follow PEP 8 style guide
- Use type hints for function signatures
- Use descriptive variable names
- Add docstrings for public functions

#### Database Management

- **Never commit the database file** (`backend/data/civicpulse.db`) to version control
- The database is initialized automatically on first use
- Use migrations or schema updates carefully - test on development data first
- Always backup the database before major schema changes

#### Configuration Files

- **Config files** in `backend/configs/` are version controlled
- Each source should have its own YAML config file
- Validate configs using: `python ingestion/config_loader.py --validate configs/[file].yaml`
- Configs must match the schema in `backend/configs/schema.json`

#### Environment Variables

- Frontend: Create `.env.local` in `civicpulse/` if needed (not currently used)
- Backend: Use `CIVICPULSE_KEYWORDS` environment variable for PDF processing keyword counting

#### Git Workflow

1. Create feature branches from `main`
2. Make focused, atomic commits
3. Write clear commit messages following conventional commits
4. Test changes before pushing
5. Create pull requests for review before merging to `main`

#### Debugging Tips

**Frontend:**
- Use Next.js dev server with `npm run dev` for hot reloading
- Check browser console for errors
- Use React DevTools for component debugging

**Backend:**
- Use Python debugger (`pdb`) or IDE debugger
- Check logs in `backend/processing/logs/` for OCR processing
- Verify database state using SQLite CLI: `sqlite3 backend/data/civicpulse.db`

#### Common Issues and Solutions

**Database errors:**
- Ensure database exists: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`
- Check file permissions on database file

**Import errors:**
- Ensure you're in the correct directory (`backend/` for Python scripts, `civicpulse/` for Node.js)
- Install dependencies: `npm install` (frontend) or `pip install -r requirements.txt` (backend)

**Test failures:**
- Clear Jest cache: `npm test -- --clearCache`
- Ensure database mocks are properly set up
- Check that all dependencies are installed

## Additional Resources

- **Project README**: See `README.md` for installation and setup instructions
- **Frontend Testing Docs**: See `civicpulse/TESTING.md` for detailed frontend testing documentation
- **Backend Ingestion Docs**: See `backend/ingestion/README.md` for ingestion pipeline details
- **Backend Processing Docs**: See `backend/processing/README.md` for PDF processing details
- **Project Resources**: 
  - [Google Drive Folder](https://drive.google.com/drive/u/0/folders/1Wh39wf2u9p57_MJBxRb5pMr-eDxBl84j)
  - [Linear Board](https://linear.app/cs1060f25)

---

**Last Updated**: 2025-11-05
**Maintainers**: CivicPulse Development Team

