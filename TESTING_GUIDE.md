# Testing Guide for CivicPulse Modules

This guide provides step-by-step instructions for testing each module in the CivicPulse pipeline.

## Prerequisites

Before testing, ensure you have:
- **Docker** and **Docker Compose** installed
- **Node.js** 18.x+ and **npm** installed
- **Python** 3.9+ and **pip** installed
- **SQLite3** installed
- Database initialized: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`

---

## 1. Test Ingestion Module

### Local Testing

```bash
cd civicpulse/src/ingestion

# Install dependencies
pip install -r requirements.txt

# Test 1: Validate configuration
python config_loader.py --validate wichita_city_council.yaml

# Expected output:
# ✓ Config valid: wichita_city_council.yaml
#   ID: wichita_city_council
#   Basis: nearest_tuesday
#   Offset: -14 days
#   Format: MMMMM d, yyyy

# Test 2: Initialize database
python -c "from local_db import init_db; init_db(); print('Database initialized')"

# Test 3: Test duplicate prevention
python test_duplicate_cli.py \
  --source_id test_source \
  --file_url https://example.com/test.pdf \
  --file_path ../../../sample.pdf

# Test 4: Run unit tests (requires pytest)
pip install pytest
python -m pytest tests/
```

### Docker Testing

```bash
cd civicpulse

# Build and run ingestion service
docker-compose build ingestion
docker-compose up ingestion

# In another terminal, test the service
docker-compose exec ingestion python config_loader.py --validate wichita_city_council.yaml
```

**Verification:**
- Config validation should succeed
- Database should be initialized
- Duplicate test should show "created" on first run, "duplicate" on second run

---

## 2. Test Processing Module

### Local Testing

**Prerequisites:** Tesseract OCR must be installed on your system.

```bash
cd civicpulse/src/processing

# Install dependencies
pip install -r requirements.txt

# Install Tesseract OCR (if not already installed)
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
# macOS: brew install tesseract
# Linux: sudo apt-get install tesseract-ocr

# Verify Tesseract is installed
tesseract --version

# Test 1: Process PDFs
# Place test PDFs in backend/processing/test_files/
python pdf_processor.py

# Check output
ls backend/processing/output/
ls backend/processing/logs/

# Test 2: Run unit tests
pip install pytest
python -m pytest tests/
```

**Verification:**
- PDFs should be processed
- Text files should be created in `backend/processing/output/`
- Summary CSV should be created in `backend/processing/logs/summary.csv`

### Docker Testing

```bash
cd civicpulse

# Build and run processing service
docker-compose build processing
docker-compose up processing

# Check logs
docker-compose logs processing
```

---

## 3. Test Frontend (Local)

### Setup

```bash
cd civicpulse/src/app

# Install dependencies (first time only)
npm install

# Verify database is accessible
# The database should be at: ../../backend/data/civicpulse.db
```

### Run Development Server

```bash
npm run dev
```

### Test the Application

1. **Open the frontend:**
   - Navigate to http://localhost:3000
   - You should see the home page

2. **Test the search page:**
   - Navigate to http://localhost:3000/search
   - The search interface should load
   - Filters should be visible (document types, counties, date range)
   - Document list should load (may be empty if no documents)

3. **Test the API:**
   ```bash
   # Get all documents
   curl http://localhost:3000/api/documents
   
   # Filter by impact
   curl 'http://localhost:3000/api/documents?impact=High'
   
   # Search with query
   curl 'http://localhost:3000/api/documents?query=solar'
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

### Verify Database Connection

The frontend should automatically find the database at:
- `../../backend/data/civicpulse.db` (relative to `src/app/`)

If the database is not found, check:
1. Database exists: `ls ../../backend/data/civicpulse.db`
2. Database is initialized: Run `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`

---

## 4. Test Full Pipeline with Docker Compose

### Start All Services

```bash
cd civicpulse

# Build all images
docker-compose build

# Start all services
docker-compose up
```

### Verify Services

1. **Frontend:** http://localhost:3000
2. **Check logs:**
   ```bash
   docker-compose logs frontend
   docker-compose logs ingestion
   docker-compose logs processing
   ```

3. **Test individual services:**
   ```bash
   # Test ingestion service
   docker-compose exec ingestion python config_loader.py --validate wichita_city_council.yaml
   
   # Test processing service
   docker-compose exec processing python pdf_processor.py
   ```

### Stop Services

```bash
docker-compose down
```

---

## Common Issues

### Database Not Found

**Error:** `ENOENT: no such file or directory`

**Solution:**
1. Ensure database is initialized: `sqlite3 backend/data/civicpulse.db < backend/db/schema.sql`
2. Check database path in `src/app/lib/db.ts`
3. Verify database exists: `ls backend/data/civicpulse.db`

### Python Not Found

**Error:** `Python was not found`

**Solution:**
1. Install Python 3.9+ from python.org
2. Add Python to PATH
3. Verify: `python --version`

### Tesseract Not Found (Processing Module)

**Error:** `pytesseract.pytesseract.TesseractNotFoundError`

**Solution:**
1. Install Tesseract OCR:
   - Windows: https://github.com/UB-Mannheim/tesseract/wiki
   - macOS: `brew install tesseract`
   - Linux: `sudo apt-get install tesseract-ocr`
2. Verify: `tesseract --version`

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
1. Find process: `netstat -ano | findstr :3000` (Windows) or `lsof -i :3000` (macOS/Linux)
2. Kill process or change port in `docker-compose.yml`

---

## Expected Test Results

### Ingestion Module
- ✅ Config validation succeeds
- ✅ Database initialization succeeds
- ✅ Duplicate prevention works (first save = "created", second save = "duplicate")
- ✅ All unit tests pass

### Processing Module
- ✅ PDFs are processed successfully
- ✅ Text files are generated in output directory
- ✅ Summary CSV is created
- ✅ All unit tests pass

### Frontend Module
- ✅ Development server starts on port 3000
- ✅ Home page loads
- ✅ Search page loads with filters
- ✅ API endpoints return data
- ✅ All Jest tests pass

---

## Next Steps

After testing all modules:
1. Verify the full pipeline works with Docker Compose
2. Test with real data (ingest actual PDFs)
3. Process documents through the full pipeline
4. Verify end-to-end data flow from ingestion → processing → frontend

