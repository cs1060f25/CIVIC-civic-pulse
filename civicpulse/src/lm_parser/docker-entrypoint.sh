#!/bin/bash
set -e

echo "--- PREPARING LM PARSER CONTAINER ENVIRONMENT ---"

# Load Google API key for Gemini if provided via file
# Strip whitespace/newlines to prevent "Illegal header value" errors
if [ -n "$GOOGLE_API_KEY_PATH" ] && [ -f "$GOOGLE_API_KEY_PATH" ]; then
  export GOOGLE_API_KEY=$(cat "$GOOGLE_API_KEY_PATH" | tr -d '\r\n' | xargs)
  echo "Successfully exported GOOGLE_API_KEY."
fi

# Check if API key is set
if [ -z "$GOOGLE_API_KEY" ]; then
  echo "ERROR: No API key found. Please set GOOGLE_API_KEY_PATH or provide GOOGLE_API_KEY env var."
  exit 1
fi

echo "--- RUNNING CIVICPULSE DOCUMENT METADATA PARSER ---"

# Default arguments target processing outputs and SQLite database
DEFAULT_INPUT_DIR=${CIVICPULSE_PROCESSING_OUTPUT_DIR:-/app/backend/processing/output}
DEFAULT_DB_PATH=${CIVICPULSE_DB_PATH:-/app/backend/db/civicpulse.db}

exec uv run python parse_documents.py \
  --input_dir "$DEFAULT_INPUT_DIR" \
  --db_path "$DEFAULT_DB_PATH" \
  "$@"

