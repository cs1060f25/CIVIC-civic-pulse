# CivicPulse

CivicPulse helps track local government documents and policy changes across Kansas. The platform aggregates agendas, minutes, ordinances, and other public documents from county and city meetings, making it easy to discover local trends before they break nationally.

## Project Resources

- [Google Drive Folder](https://drive.google.com/drive/u/0/folders/1Wh39wf2u9p57_MJBxRb5pMr-eDxBl84j)
- [Linear Board](https://linear.app/cs1060f25)

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)

---

## Prerequisites

- **Node.js** 18.x or later
- **npm** 9.x or later
- **SQLite3** (for database management)
- **Python 3.9+** (for backend ingestion scripts)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/cs1060f25/CIVIC-civic-pulse.git
cd CIVIC-civic-pulse
```

### 2. Install Frontend Dependencies

```bash
cd civicpulse
npm install
```

### 3. Install Backend Dependencies (Optional - for ingestion scripts)

```bash
cd ../backend
pip install -r requirements.txt  # If requirements.txt exists
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

### Development Mode

```bash
cd civicpulse
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Search UI:** http://localhost:3000/search
- **API:** http://localhost:3000/api/documents

### Production Build

```bash
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

## Testing

### 1. Test the API

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
├── backend/
│   ├── configs/           # Source configuration files
│   ├── data/              # SQLite database files
│   │   └── civicpulse.db
│   ├── db/                # Database schemas
│   │   └── schema.sql
│   ├── ingestion/         # Document scraping scripts
│   └── processing/        # PDF processing utilities
├── civicpulse/            # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── documents/  # API routes
│   │   │   ├── search/         # Search UI page
│   │   │   ├── globals.css     # Global styles
│   │   │   └── layout.tsx      # Root layout
│   │   ├── components/    # Reusable UI components
│   │   │   ├── Navbar.tsx
│   │   │   └── ui.tsx
│   │   └── lib/           # Utilities and types
│   │       ├── db.ts      # Database connection
│   │       ├── mock.ts    # Mock data for development
│   │       ├── state.tsx  # App state management
│   │       └── types.ts   # TypeScript definitions
│   ├── package.json
│   └── next.config.ts
└── README.md
```

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
