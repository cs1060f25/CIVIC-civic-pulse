LM Parser - CivicPulse Document Metadata Extraction

This module uses LangChain with Google GenAI to extract structured JSON metadata from processed local government PDFs (agendas, minutes, ordinances, etc.) and writes records into the SQLite document store.

Requirements
- API key via one of: `GENAI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENAI_API_KEY`
- Python 3.11+
- Database initialized from `backend/db/schema.sql`

Install (local)
1. From `civicpulse/src/lm_parser/` install deps (uv or pip):
   - `uv pip install -e .` or `pip install -e .`

Inputs
- Reads JSON outputs produced by the processing module:
  - Default input dir: `backend/processing/output/`
  - Each JSON file includes per-page text collected by `src/processing/pdf_processor.py`

Outputs (to SQLite)
- Writes to `backend/data/civicpulse.db` in tables:
  - `documents (id, source_id, file_url, content_hash, bytes_size, created_at)`
  - `document_metadata (document_id, title, entity, jurisdiction, counties, meeting_date, doc_types, topics, impact, stage, keyword_hits, extracted_text, pdf_preview, attachments, updated_at)`

Run
```bash
# From project root or civicpulse/
python civicpulse/src/lm_parser/parse_documents.py \
  --input_dir backend/processing/output \
  --db_path backend/data/civicpulse.db \
  --model gemini-2.5-flash \
  --source_id local_processing \
  --url_prefix local: \
  --limit 10
```

Environment Overrides
- `CIVICPULSE_PROCESSING_OUTPUT_DIR`: default input dir
- `CIVICPULSE_DB_PATH`: default SQLite DB path
- `GENAI_MODEL`: default model name
- `GOOGLE_API_KEY`: API key for model (or use `GOOGLE_API_KEY_PATH` in Docker)

Notes
- `id` is derived deterministically from a SHA-256 hash of the extracted context to be idempotent across runs.
- `file_url` defaults to `local:<relative-path>` from the processing output; adjust with `--url_prefix` for other storage backends.
- The parser aims to fill required fields (`title`, `entity`, `jurisdiction`) and sensible defaults for JSON arrays/objects per schema.

Docker Secrets
- Place your API key in `../../secrets/google_api_key.txt` (relative to `CIVIC-civic-pulse/`).
- The `lm-parser` service mounts this file and sets `GOOGLE_API_KEY_PATH=/run/secrets/google_api_key.txt`.
