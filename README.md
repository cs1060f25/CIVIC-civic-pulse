# CivicPulse

**🌐 Live Site:** [https://civicpulse.dev](https://civicpulse.dev)

CivicPulse helps track local government documents and policy changes across Kansas. The platform aggregates agendas, minutes, ordinances, and other public documents from county and city meetings, making it easy to discover local trends before they break nationally.

## Project Resources

- [Google Drive Folder](https://drive.google.com/drive/u/0/folders/1Wh39wf2u9p57_MJBxRb5pMr-eDxBl84j)
- [Linear Board](https://linear.app/cs1060f25)

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start with Docker Compose](#quick-start-with-docker-compose)
- [Local Development (Without Docker)](#local-development-without-docker)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing Modules](#testing-modules)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)

For detailed testing instructions, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## Prerequisites

- **Docker** and **Docker Compose** (for running all modules together)
- **Node.js** 18.x or later (for local frontend development)
- **npm** 9.x or later
- **Python 3.9+** (for local ingestion/processing development)
- **SQLite3** (for database management)

---

## Quick Start with Docker Compose

The easiest way to run the entire pipeline is using Docker Compose, which orchestrates all three modules (frontend, ingestion, and processing).

### 1. Clone the Repository

```bash
git clone https://github.com/cs1060f25/CIVIC-civic-pulse.git
cd CIVIC-civic-pulse
```

### 2. Initialize the Database

```bash
# From project root
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

### 3. Start All Services with Docker Compose

```bash
cd civicpulse
docker-compose up --build
```

This will:
- Build Docker images for all three modules (frontend, ingestion, processing)
- Start all services in the correct order
- Mount the backend data/configs directories for shared access

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **Search UI:** http://localhost:3000/search
- **API:** http://localhost:3000/api/documents

### 5. Stop Services

```bash
docker-compose down
```

### 6. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f ingestion
docker-compose logs -f processing
```

### 7. Run Individual Services

```bash
# Run only frontend
docker-compose up frontend

# Run only ingestion
docker-compose up ingestion

# Run only processing
docker-compose up processing
```

---

## Local Development (Without Docker)

If you prefer to develop locally without Docker:

### 1. Install Frontend Dependencies

```bash
cd civicpulse/src/app
npm install
```

### 2. Install Backend Dependencies

```bash
# Ingestion module
cd ../ingestion
pip install -r requirements.txt

# Processing module
cd ../processing
pip install -r requirements.txt
```

---

## Database Setup

### 1. Initialize the Database

The database schema is located in `backend/db/schema.sql`. To create the database:

```bash
# From project root
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

This creates two tables:
- **`documents`** - Core document metadata (id, source_id, file_url, content_hash, bytes_size, created_at)
- **`document_metadata`** - Rich metadata (title, entity, jurisdiction, counties, meeting_date, doc_types, topics, impact, etc.)

### 2. Verify Database Setup

```bash
sqlite3 backend/data/civicpulse.db ".tables"
# Expected output: document_metadata  documents
```

### 3. Add Sample Data (Optional)

See `backend/db/seed.sql` if available, or use the API to add documents.

---

## Running the Application

### Option 1: Docker Compose (Recommended)

See [Quick Start with Docker Compose](#quick-start-with-docker-compose) above.

### Option 2: Local Development

#### Frontend (Next.js)

```bash
cd civicpulse/src/app
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Search UI:** http://localhost:3000/search
- **API:** http://localhost:3000/api/documents

#### Ingestion Module

```bash
cd civicpulse/src/ingestion

# Test config loading
python config_loader.py --validate wichita_city_council.yaml

# Ingest a single PDF
python single_link_scraper.py \
  --config wichita_city_council.yaml \
  --source_id wichita_city_council \
  --url https://www.wichita.gov/meeting_agendas/2025-10-21_agenda.pdf \
  --outdir data/sandbox
```

#### Processing Module

```bash
cd civicpulse/src/processing

# Process PDFs (requires Tesseract OCR)
python pdf_processor.py
```

### Production Build

```bash
cd civicpulse/src/app
npm run build
npm start
```

---

## API Documentation

### GET `/api/documents`

Retrieve documents with filtering, pagination, and search.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `query` | string | Text search across title, entity, topics | `?query=solar` |
| `docTypes` | string | Comma-separated document types | `?docTypes=Agenda,Minutes` |
| `counties` | string | Comma-separated counties | `?counties=Johnson,Sedgwick` |
| `impact` | string | Comma-separated impact levels | `?impact=High,Medium` |
| `stage` | string | Comma-separated stages | `?stage=Hearing,Vote` |
| `topics` | string | Comma-separated topics | `?topics=zoning,education` |
| `meetingDateFrom` | string | Start date (YYYY-MM-DD) | `?meetingDateFrom=2025-10-01` |
| `meetingDateTo` | string | End date (YYYY-MM-DD) | `?meetingDateTo=2025-10-31` |
| `daysBack` | number | Last N days | `?daysBack=30` |
| `limit` | number | Results per page (max 100) | `?limit=20` |
| `offset` | number | Pagination offset | `?offset=0` |
| `sortBy` | string | Sort field | `?sortBy=meetingDate` |
| `sortOrder` | string | Sort direction (asc/desc) | `?sortOrder=desc` |

**Example Request:**
```bash
curl 'http://localhost:3000/api/documents?impact=High&limit=5'
```

**Response:**
```json
{
  "documents": [ /* array of document objects */ ],
  "pagination": {
    "total": 10,
    "limit": 5,
    "offset": 0,
    "hasMore": true
  }
}
```

### POST `/api/documents`

Create a new document.

**Request Body:**
```json
{
  "sourceId": "johnson_county_planning",
  "fileUrl": "https://example.com/agenda.pdf",
  "contentHash": "sha256-hash",
  "bytesSize": 524288,
  "title": "Planning Board Meeting Agenda",
  "entity": "Johnson County Planning Board",
  "jurisdiction": "Johnson County, KS",
  "counties": ["Johnson"],
  "meetingDate": "2025-10-27",
  "docTypes": ["Agenda"],
  "impact": "Medium",
  "topics": ["zoning", "land use"]
}
```

**Response (201 Created):**
```json
{
  "id": "generated-uuid",
  "sourceId": "johnson_county_planning",
  "title": "Planning Board Meeting Agenda",
  /* ...all fields from request... */
  "createdAt": "2025-10-27T20:00:00Z",
  "updatedAt": "2025-10-27T20:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or validation error
- `409 Conflict` - Duplicate document (same content_hash)
- `500 Internal Server Error` - Server error

---

## Testing Modules

### 1. Test Ingestion Module

**Prerequisites:** Python 3.9+ and PyYAML installed

```bash
cd civicpulse/src/ingestion

# Install dependencies
pip install -r requirements.txt

# Validate config
python config_loader.py --validate wichita_city_council.yaml

# Test duplicate prevention
python test_duplicate_cli.py \
  --source_id wichita_city_council \
  --file_url https://example.com/test.pdf \
  --file_path ../../../sample.pdf

# Run tests (requires pytest)
pip install pytest
python -m pytest tests/
```

**Expected output for config validation:**
```
✓ Config valid: wichita_city_council.yaml
  ID: wichita_city_council
  Basis: nearest_tuesday
  Offset: -14 days
  Format: MMMMM d, yyyy
```

### 2. Test Processing Module

**Prerequisites:** Python 3.9+, Tesseract OCR, and dependencies installed

```bash
cd civicpulse/src/processing

# Install dependencies
pip install -r requirements.txt

# Install Tesseract OCR (system dependency)
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
# macOS: brew install tesseract
# Linux: sudo apt-get install tesseract-ocr

# Process PDFs (reads from backend/processing/test_files/)
python pdf_processor.py

# Run tests
pip install pytest
python -m pytest tests/
```

**Note:** The processing module requires Tesseract OCR to be installed on your system. Output files will be written to `backend/processing/output/`.

### 3. Test Frontend (Local)

**Prerequisites:** Node.js 18.x+ and npm installed

```bash
cd civicpulse/src/app

# Install dependencies (first time only)
npm install

# Run development server
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Search UI:** http://localhost:3000/search
- **API:** http://localhost:3000/api/documents

**Run tests:**
```bash
npm test
```

**Verify the frontend is working:**
1. Open http://localhost:3000 in your browser
2. Navigate to http://localhost:3000/search
3. The search interface should load with filters and document list
4. Test the API endpoint: http://localhost:3000/api/documents

**Note:** Make sure the database is initialized before running the frontend:
```bash
# From project root
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

### 4. Test the API

**Get all documents:**
```bash
curl http://localhost:3000/api/documents
```

**Filter by impact:**
```bash
curl 'http://localhost:3000/api/documents?impact=High'
```

**Search with text query:**
```bash
curl 'http://localhost:3000/api/documents?query=solar'
```

**Create a document:**
```bash
curl -X POST http://localhost:3000/api/documents \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceId": "test",
    "fileUrl": "https://test.com/doc.pdf",
    "contentHash": "unique-hash-123",
    "bytesSize": 1000,
    "title": "Test Document",
    "entity": "Test Entity",
    "jurisdiction": "Test County, KS"
  }'
```

### 2. Test the Frontend

1. Navigate to http://localhost:3000/search
2. Use the filters to search documents:
   - Select document types (Agenda, Minutes, etc.)
   - Choose counties
   - Adjust date range slider
   - Enter search queries
3. Select documents and click "Add to Brief"

### 3. Verify Database

```bash
# Check document count
sqlite3 backend/data/civicpulse.db "SELECT COUNT(*) FROM documents;"

# View sample documents
sqlite3 backend/data/civicpulse.db "SELECT id, title, entity FROM document_metadata LIMIT 5;"

# Check for duplicates
sqlite3 backend/data/civicpulse.db "SELECT content_hash, COUNT(*) FROM documents GROUP BY content_hash HAVING COUNT(*) > 1;"
```

---

## Project Structure

```
CIVIC-civic-pulse/
├── backend/                    # Data and database only
│   ├── configs/                # Source configuration files
│   ├── data/                   # SQLite database and data files
│   │   └── civicpulse.db
│   └── db/                     # Database schemas
│       └── schema.sql
│
├── civicpulse/                 # Main application
│   ├── docker-compose.yml      # Orchestrates all modules
│   └── src/
│       ├── app/                # Frontend Next.js module
│       │   ├── app/            # Next.js App Router
│       │   │   ├── api/        # API routes
│       │   │   ├── layout.tsx  # Root layout
│       │   │   └── page.tsx    # Home page
│       │   ├── components/     # React components
│       │   ├── lib/            # Utilities and types
│       │   ├── public/         # Static assets
│       │   ├── package.json   # Frontend dependencies
│       │   ├── next.config.ts  # Next.js config
│       │   └── Dockerfile      # Frontend Dockerfile
│       │
│       ├── ingestion/          # Ingestion module
│       │   ├── config_loader.py
│       │   ├── local_db.py
│       │   ├── single_link_scraper.py
│       │   ├── requirements.txt
│       │   ├── tests/
│       │   └── Dockerfile      # Ingestion Dockerfile
│       │
│       └── processing/         # Processing module
│           ├── pdf_processor.py
│           ├── requirements.txt
│           ├── tests/
│           └── Dockerfile      # Processing Dockerfile
│
└── README.md
```

### Modular Architecture

The project uses a **modular deployment architecture** where each module has its own Dockerfile:

1. **Frontend Module** (`src/app/`): Next.js application with React components
2. **Ingestion Module** (`src/ingestion/`): Python scripts for scraping and ingesting documents
3. **Processing Module** (`src/processing/`): Python scripts for PDF processing and OCR

All modules share access to the `backend/` directory for:
- Database (`backend/data/civicpulse.db`)
- Configuration files (`backend/configs/`)
- Database schema (`backend/db/schema.sql`)

---

## Development Workflow

### Creating a New Feature

1. **Create a feature branch from main:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

3. **Test your changes:**
   - Run the dev server
   - Test API endpoints
   - Verify UI functionality

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push -u origin feature/your-feature-name
   ```

5. **Create a Pull Request** on GitHub

6. **After review, merge to main**

### Key Branches

- **`main`** - Production-ready code
- **`frontend-search`** - Search UI development (merged)
- **`api-gateway`** - API implementation (in progress)
- **`backend-schema-modification`** - Database schema updates (merged)

---

## Technology Stack

- **Frontend:** Next.js 15, React, TypeScript, TailwindCSS
- **API:** Next.js API Routes
- **Database:** SQLite with better-sqlite3
- **Styling:** TailwindCSS with custom design system
- **State Management:** React Context + localStorage

---

## Environment Variables

Create a `.env.local` file in the `civicpulse/` directory if needed:

```env
# Add environment variables here if needed in the future
# DATABASE_URL=...
# API_KEY=...
```

---

## Troubleshooting

### Database not found error

```bash
# Ensure the database exists
ls -la backend/data/civicpulse.db

# If missing, create it
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

### API returns "no such table" error

The `document_metadata` table might be missing. Re-run the schema:

```bash
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

### Dev server won't start

```bash
# Clear Next.js cache
cd civicpulse
rm -rf .next
npm install
npm run dev
```

---

## Contributing

1. Follow the development workflow above
2. Write meaningful commit messages (follow conventional commits)
3. Test your changes before pushing
4. Create focused pull requests (one feature per PR)
5. Request reviews from team members

---

## License

TBD

---

## Contact

For questions or issues, please contact the development team or create an issue on GitHub.
