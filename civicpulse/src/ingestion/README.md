# Ingestion Module

This module provides a scriptable pipeline to ingest individual PDF files from known domains, validate and store them in a local SQLite database, and prevent duplicates.

## Overview

The ingestion module handles:
- **Config Validation**: Validates YAML configuration files against schema
- **PDF Download**: Downloads PDFs from allowed domains with validation
- **Duplicate Prevention**: Uses content hashing to prevent duplicate documents
- **Database Storage**: Stores document metadata in SQLite database

## Module Structure

```
src/ingestion/
├── config_loader.py         # Config loading and validation
├── local_db.py              # Database operations
├── regex_runtime.py         # Date-based regex building
├── single_link_scraper.py   # Main CLI tool for ingesting PDFs
├── test_duplicate_cli.py    # CLI tool for testing duplicate prevention
├── tests/                   # Unit tests
├── requirements.txt         # Python dependencies
├── Dockerfile               # Docker configuration
└── README.md               # This file
```

## Components

- `config_loader.py`
  - Loads YAML config and validates it against `backend/configs/schema.json`.
  - Computes a target date string based on config rules (useful for building date-aware matchers elsewhere).
- `local_db.py`
  - Initializes the SQLite DB (`backend/data/civicpulse.db`) using `backend/db/schema.sql`.
  - Provides `save_if_new(source_id, file_url, content_bytes)` which inserts a document row if new, or reports `duplicate` based on a content hash.
- `regex_runtime.py`
  - Builds a compiled regex by interpolating a formatted date string into a template placeholder `{{TARGET_DATE}}`.
- `single_link_scraper.py`
  - CLI tool to download a single URL (expected to be a PDF), verify domain/content type, save metadata in DB, and optionally persist the file to disk.
- `test_duplicate_cli.py`
  - CLI to test `save_if_new` by reading a local file and verifying duplicate prevention.

## Prerequisites

- Python 3.10+ (tested with 3.13 on macOS)
- Dependencies:
  - PyYAML: `pip install pyyaml`
- Project files expected (paths are relative to the repo root):
  - `backend/configs/schema.json` (JSON schema for config validation)
  - `backend/configs/<your-config>.yaml` (your YAML config, e.g., `wichita_city_council.yaml`)
  - `backend/db/schema.sql` (DDL to initialize the `documents` table; must enforce uniqueness on `content_hash`)

## Configuration

Example config file location:

```
backend/configs/wichita_city_council.yaml
```

`config_loader.py` expects `schema.json` at:

```
backend/configs/schema.json
```

Config fields expected by the current tooling include (non-exhaustive):

- `id`: string identifier for this source (e.g., `wichita_city_council`).
- `allowed_domains`: list of domains (e.g., `["wichita.gov"]`). Used to restrict `single_link_scraper.py`.
- `date_selection`: controls how a target date is computed for pattern matching; fields include:
  - `basis`: e.g., `nearest_tuesday`
  - `offset_days`: integer, can be negative
  - `match_format`: format string, e.g., `MMMM d, yyyy`
- `selectors.link_text_regex`: optional template containing `{{TARGET_DATE}}`, used by `regex_runtime.py` when building a runtime regex.

Validate a config:

```bash
# From civicpulse/src/ingestion/
python config_loader.py --validate wichita_city_council.yaml
```

Compute a target date string using the config:

```bash
# From civicpulse/src/ingestion/
python config_loader.py --target-date 2025-10-27 wichita_city_council.yaml
# Example output: "October 7, 2025"
```

## Database Initialization

`single_link_scraper.py` and `test_duplicate_cli.py` will initialize the database automatically on first run if `backend/data/civicpulse.db` does not exist, by applying `backend/db/schema.sql`.

You can also initialize manually via `local_db.py`:

```bash
# From civicpulse/src/ingestion/
python -c "from local_db import init_db; init_db(); print('DB initialized')"
```

## Ingesting a Single PDF

Download a single URL (must be a PDF), verify domain, store a record in the DB, and save the file if it's new:

```bash
# From civicpulse/src/ingestion/
python single_link_scraper.py \
  --config wichita_city_council.yaml \
  --source_id wichita_city_council \
  --url https://www.wichita.gov/meeting_agendas/2025-10-21_agenda.pdf \
  --outdir data/sandbox \
  --filename council_agenda.pdf
```

Output (JSON to stdout):

```json
{
  "status": "created" | "duplicate" | "error",
  "document_id": "<uuid>",
  "bytes": <size>,
  "url": "<input-url>",
  "saved_path": "backend/data/sandbox/<source_id>/<timestamp>_<filename>.pdf" | null,
  "reason": null | "not a PDF" | "Domain '...' not in allowed domains: [...]" | <error>
}
```

- `status = created`: a new record was inserted; file is saved to `backend/data/sandbox/<source_id>/` with a UTC timestamp prefix.
- `status = duplicate`: content hash already exists in DB; `saved_path` will be null.

## Duplicate Test Utility

```bash
# From civicpulse/src/ingestion/
python test_duplicate_cli.py \
  --source_id wichita_city_council \
  --file_url https://example.com/test.pdf \
  --file_path ./some/local/file.pdf
```

This prints the dedup result and shows consistent `content_hash` and `document_id` across duplicate saves.

## Regex Builder Utility

If your config includes a template under `selectors.link_text_regex` like `"Meeting for {{TARGET_DATE}}"`, you can build a runtime regex:

```python
from regex_runtime import build_date_regex_from_config
from config_loader import load_config, compute_target_date
from datetime import date

config = load_config("wichita_city_council.yaml")
formatted_date = compute_target_date(date(2025,10,27), config)
pattern = build_date_regex_from_config(config, formatted_date)

assert pattern.search(f"Meeting for {formatted_date}")
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t civicpulse-ingestion .
```

### Run Container

```bash
docker run -v ../../backend/configs:/app/backend/configs:ro \
  -v ../../backend/data:/app/backend/data \
  -v ../../backend/db:/app/backend/db:ro \
  civicpulse-ingestion
```

Or use Docker Compose (see `../../docker-compose.yml`).

## Testing

### Run Unit Tests

```bash
# Install pytest
pip install pytest

# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_local_db.py
```

## Troubleshooting

- **"Config file not found"**: The config file should be referenced by filename (will look in `backend/configs/`) or provide full path.
- **"Schema file not found"**: Ensure `backend/configs/schema.json` exists.
- **Not a PDF**: The URL must either have `Content-Type: application/pdf` or begin with the PDF magic bytes `%PDF-`.
- **Missing PyYAML**: `pip install pyyaml`.
- **Database path errors**: Ensure the module can access `../../backend/` directory (4 levels up from this module).

