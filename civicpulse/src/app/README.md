# Frontend Module (Next.js App)

This module contains the CivicPulse frontend application built with Next.js 15, React 19, and TypeScript.

## Overview

The frontend module provides:
- **User Interface**: Search interface for finding and filtering documents
- **API Routes**: RESTful API for document management
- **Database Integration**: SQLite database access via better-sqlite3
- **State Management**: React Context for application state

## Structure

```
src/app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── documents/     # Document API endpoints
│   ├── search/            # Search page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Navbar.tsx         # Navigation bar
│   └── ui.tsx             # UI components (buttons, cards, badges)
├── lib/                   # Utilities and types
│   ├── db.ts              # Database connection
│   ├── types.ts           # TypeScript definitions
│   ├── state.tsx          # State management
│   └── mock.ts            # Mock data for development
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
└── Dockerfile             # Docker configuration
```

## Prerequisites

- **Node.js** 18.x or later
- **npm** 9.x or later
- **SQLite3** database (shared with other modules)

## Installation

```bash
cd src/app
npm install
```

## Development

### Run Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:3000
- **Search UI:** http://localhost:3000/search
- **API:** http://localhost:3000/api/documents

### Build for Production

```bash
npm run build
npm start
```

## Configuration

### Database Path

The database path is automatically resolved in `lib/db.ts`. It tries multiple locations:
1. `backend/data/civicpulse.db` (Docker/standalone)
2. `../../../backend/data/civicpulse.db` (Local development)
3. `../../../../backend/data/civicpulse.db` (Alternative)

### Environment Variables

Create a `.env.local` file if needed:

```env
# Database path override (optional)
DATABASE_PATH=/path/to/civicpulse.db

# Next.js environment
NODE_ENV=development
```

## API Routes

### GET `/api/documents`

Retrieve documents with filtering, pagination, and search.

**Query Parameters:**
- `query`: Text search
- `docTypes`: Comma-separated document types
- `counties`: Comma-separated counties
- `impact`: Comma-separated impact levels
- `daysBack`: Number of days to look back
- `limit`: Results per page (max 100)
- `offset`: Pagination offset
- `sortBy`: Sort field (meetingDate, createdAt, impact, title)
- `sortOrder`: Sort direction (asc, desc)

**Example:**
```bash
curl 'http://localhost:3000/api/documents?impact=High&limit=10'
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

## Testing

See [TESTING.md](../../TESTING.md) for detailed testing instructions.

### Quick Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t civicpulse-frontend .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -v ../../backend/data:/app/backend/data \
  -v ../../backend/configs:/app/backend/configs:ro \
  -v ../../backend/db:/app/backend/db:ro \
  civicpulse-frontend
```

Or use Docker Compose (see `../../docker-compose.yml`).

## Troubleshooting

### Database Not Found

**Error:** `ENOENT: no such file or directory`

**Solution:**
1. Ensure database is initialized: `sqlite3 ../../backend/data/civicpulse.db < ../../backend/db/schema.sql`
2. Check database path in `lib/db.ts`
3. Verify database exists: `ls ../../backend/data/civicpulse.db`

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
1. Find the process: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (macOS/Linux)
2. Kill the process or change port: `PORT=3001 npm run dev`

### Module Not Found Errors

**Solution:**
1. Reinstall dependencies: `rm -rf node_modules && npm install`
2. Check `tsconfig.json` paths configuration
3. Verify imports use `@/` prefix correctly

## Development Tips

1. **Hot Reload**: Next.js automatically reloads on file changes
2. **TypeScript**: Use `npm run build` to check for TypeScript errors
3. **Linting**: Run `npm run lint` to check code quality
4. **API Testing**: Use the browser or curl to test API endpoints
5. **Database**: Access the database directly: `sqlite3 ../../backend/data/civicpulse.db`

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Project Testing Guide](../../TESTING.md)

