# Ingestion Module

This directory provides a small, scriptable pipeline to ingest individual PDF files from known domains, validate and store them in a local SQLite database, and prevent duplicates.

## Components

- `config_loader.py`
  - Loads YAML config and validates it against `configs/schema.json`.
  - Computes a target date string based on config rules (useful for building date-aware matchers elsewhere).
- `local_db.py`
  - Initializes the SQLite DB (`data/civicpulse.db`) using `db/schema.sql`.
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
- Project files expected (paths are relative to the repo root unless noted):
  - `backend/configs/schema.json` (JSON schema for config validation)
  - `backend/configs/<your-config>.yaml` (your YAML config, e.g., `wichita_city_council.yaml`)
  - `backend/db/schema.sql` (DDL to initialize the `documents` table; must enforce uniqueness on `content_hash`)

## Working Directory (important)

Most scripts assume paths relative to the `backend/` directory. The simplest way to run commands is to set your current working directory (CWD) to `backend/`:

```
cd backend
```

If you run from the repo root, you will need to adjust paths or update the code to resolve files relative to the script location.

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

```
# From backend/
python ingestion/config_loader.py --validate configs/wichita_city_council.yaml
```

Compute a target date string using the config:

```
# From backend/
python ingestion/config_loader.py --target-date 2025-10-27 configs/wichita_city_council.yaml
# Example output: "October 7, 2025"
```

## Database Initialization

`single_link_scraper.py` and `test_duplicate_cli.py` will initialize the database automatically on first run if `data/civicpulse.db` does not exist, by applying `db/schema.sql`.

You can also initialize manually via `local_db.py`:

```
# From backend/
python -c "from ingestion.local_db import init_db; init_db(); print('DB initialized')"
```

## Ingesting a Single PDF

Download a single URL (must be a PDF), verify domain, store a record in the DB, and save the file if it's new:

```
# From backend/
python ingestion/single_link_scraper.py \
  --config configs/wichita_city_council.yaml \
  --source_id wichita_city_council \
  --url https://www.wichita.gov/meeting_agendas/2025-10-21_agenda.pdf \
  --outdir data/sandbox \
  --filename council_agenda.pdf
```

Output (JSON to stdout):

```
{
  "status": "created" | "duplicate" | "error",
  "document_id": "<uuid>",
  "bytes": <size>,
  "url": "<input-url>",
  "saved_path": "data/sandbox/<source_id>/<timestamp>_<filename>.pdf" | null,
  "reason": null | "not a PDF" | "Domain '...' not in allowed domains: [...]" | <error>
}
```

- `status = created`: a new record was inserted; file is saved to `--outdir/<source_id>/` with a UTC timestamp prefix.
- `status = duplicate`: content hash already exists in DB; `saved_path` will be null.

## Duplicate Test Utility

```
# From backend/
python ingestion/test_duplicate_cli.py \
  --source_id wichita_city_council \
  --file_url https://example.com/test.pdf \
  --file_path ./some/local/file.pdf
```

This prints the dedup result and shows consistent `content_hash` and `document_id` across duplicate saves.

## Regex Builder Utility

If your config includes a template under `selectors.link_text_regex` like `"Meeting for {{TARGET_DATE}}"`, you can build a runtime regex:

```python
from ingestion.regex_runtime import build_date_regex_from_config
from ingestion.config_loader import load_config, compute_target_date
from datetime import date

config = load_config("configs/wichita_city_council.yaml")
formatted_date = compute_target_date(date(2025,10,27), config)
pattern = build_date_regex_from_config(config, formatted_date)

assert pattern.search(f"Meeting for {formatted_date}")
```

## Troubleshooting

- "Config file not found": Ensure you are in `backend/` and the path is `configs/<file>.yaml`.
- "Schema file not found": Ensure `backend/configs/schema.json` exists. Running from another CWD may break relative paths.
- "can't open file '.../backend/backend/...'": You are in `backend/` but invoked a path starting with `backend/`. When in `backend/`, call scripts without the extra prefix (e.g., `python ingestion/...`, not `python backend/ingestion/...`).
- Not a PDF: The URL must either have `Content-Type: application/pdf` or begin with the PDF magic bytes `%PDF-`.
- Missing PyYAML: `pip install pyyaml`.

## Notes and Future Hardening

- To allow running scripts from any CWD, update file resolution to be relative to the script file, e.g., in `config_loader.py` compute `schema_path = Path(__file__).parent.parent / "configs" / "schema.json"`.
- Consider adding retries/timeouts and more robust error reporting for downloads.
- Extend the DB schema to store additional metadata (e.g., filename, title, source page).
