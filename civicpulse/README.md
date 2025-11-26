# CivicPulse Application

This directory contains the CivicPulse application with modular architecture. The application consists of three main modules that can be deployed independently or together using Docker Compose.

## Structure

```
civicpulse/
├── docker-compose.yml      # Orchestrates all modules
├── src/
│   ├── app/                # Frontend Next.js module
│   ├── ingestion/          # Ingestion module
│   └── processing/         # Processing module
└── README.md               # This file
```

## Quick Start

### Using Docker Compose (Recommended)

The easiest way to run the entire pipeline:

```bash
# From civicpulse directory
docker-compose up --build
```

This will start all three modules:
- **Frontend** (Next.js) on http://localhost:3000
- **Ingestion** module (Python)
- **Processing** module (Python)

### Local Development

For local development without Docker, see each module's README:
- Frontend: `src/app/README.md`
- Ingestion: `src/ingestion/README.md`
- Processing: `src/processing/README.md`

## Docker Compose Commands

### Start All Services

```bash
docker-compose up --build
```

### Start in Background

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f ingestion
docker-compose logs -f processing
```

### Run Individual Services

```bash
# Only frontend
docker-compose up frontend

# Only ingestion
docker-compose up ingestion

# Only processing
docker-compose up processing
```

### Rebuild Services

```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build frontend
```

## Module Architecture

Each module is self-contained with its own Dockerfile:

1. **Frontend Module** (`src/app/`): Next.js application
   - React components and UI
   - API routes
   - Database access layer

2. **Ingestion Module** (`src/ingestion/`): Document ingestion service
   - Config loading and validation
   - PDF downloading and validation
   - Database storage with duplicate prevention

3. **Processing Module** (`src/processing/`): PDF processing service
   - Text extraction from PDFs
   - OCR for scanned documents
   - Batch processing capabilities

## Shared Resources

All modules share access to:
- **Database**: `../../backend/db/civicpulse.db`
- **Configs**: `../../backend/configs/`
- **Schema**: `../../backend/db/schema.sql`

These are mounted as volumes in Docker Compose.

## Development Workflow

1. **Make changes** to a module
2. **Rebuild** the Docker image: `docker-compose build <service-name>`
3. **Restart** the service: `docker-compose restart <service-name>`
4. **Test** the changes

## Testing

See [TESTING.md](./TESTING.md) for detailed testing instructions for the frontend module.

For module-specific testing:
- Frontend: `src/app/README.md`
- Ingestion: `src/ingestion/README.md`
- Processing: `src/processing/README.md`

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:
```bash
# Find the process
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # macOS/Linux

# Or change port in docker-compose.yml
```

### Database Not Found

Ensure the database is initialized:
```bash
# From project root
sqlite3 backend/data/civicpulse.db < backend/db/schema.sql
```

### Services Not Starting

Check logs:
```bash
docker-compose logs <service-name>
```

### Volume Mount Issues

Ensure paths are correct in `docker-compose.yml`. Volumes are mounted relative to the `civicpulse/` directory.

## Environment Variables

Set in `docker-compose.yml` or `.env` file:

- `CIVICPULSE_KEYWORDS`: Comma-separated keywords for processing module
- `NODE_ENV`: Environment for frontend (production/development)
- `CIVICPULSE_DB_PATH`: Absolute path (inside the container) to `civicpulse.db` so the Next.js API can reach SQLite
- `CIVICPULSE_SKIP_DB`: Internal flag used during Docker image builds to avoid touching the database (automatically set, no action needed)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: OAuth client ID from Google Cloud used by the frontend during build and runtime

## Additional Resources

- [Main Project README](../../README.md) - Overall project overview
- [Testing Guide](../../TESTING_GUIDE.md) - Comprehensive testing instructions
- Module-specific READMEs in each `src/` subdirectory
